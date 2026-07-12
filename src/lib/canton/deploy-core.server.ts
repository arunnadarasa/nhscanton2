// Core deploy logic, extracted from /api/public/admin/deploy so it can be
// invoked in-process (avoids Worker subrequest-to-self 502s).

import { getCantonEndpoints, getCantonMode } from "@/lib/canton/mode.server";
import { ICBS, TRUSTS } from "@/lib/nhs/data";

const DEFAULT_USER_ID = "lovable-nhs-app";
// Upload order matters: mock-usdcx is a data-dependency of nhs-budget-app-v2.
const DAR_ASSET_PATHS = [
  "/dars/mock-usdcx-1.0.0.dar.bin",
  "/dars/nhs-budget-app-v2-1.0.2.dar.bin",
];
const DAR_ASSET_PATH = DAR_ASSET_PATHS[DAR_ASSET_PATHS.length - 1]!;

function defaultParties() {
  return [
    "DHSC",
    "NHSEngland",
    "Auditor",
    ...ICBS.map((i) => `ICB-${i.code}`),
    ...TRUSTS.map((t) => `Trust-${t.code}`),
  ];
}

type AllocResult = { hint: string; partyId?: string; error?: string };

export type RunDeployOpts = {
  parties?: string[];
  userId?: string;
  baseUrl: string; // used to resolve the bundled DAR for localnet
};

export async function runDeploy(opts: RunDeployOpts): Promise<Response> {
  const mode = getCantonMode();
  const { ledgerApi, adminApi } = getCantonEndpoints();
  if (!ledgerApi || mode === "memory") {
    return Response.json(
      {
        error: "missing-config",
        missing: {
          CANTON_JSON_API_URL: !ledgerApi,
          CANTON_MODE: mode === "memory" ? "memory (set CANTON_MODE=localnet or devnet)" : false,
        },
      },
      { status: 500 },
    );
  }

  const parties = (opts.parties ?? defaultParties()).filter(
    (p) => typeof p === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(p),
  );
  let userId = opts.userId ?? DEFAULT_USER_ID;
  const adminBase = (adminApi ?? ledgerApi).replace(/\/+$/, "");
  const ledgerBase = ledgerApi.replace(/\/+$/, "");

  const { getAdminAccessToken, getRuntimeAccessToken, getRuntimeLedgerUserId } = await import(
    "@/lib/canton/tokens.server"
  );
  let adminJwt: string;
  try {
    adminJwt = await getAdminAccessToken();
  } catch (e) {
    return Response.json(
      { mode, error: "mint-admin-token-failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
  const auth = { Authorization: `Bearer ${adminJwt}` };

  let runtimeUserId: string | undefined;
  if (mode === "devnet" && !opts.userId) {
    try {
      runtimeUserId = await getRuntimeLedgerUserId();
      if (runtimeUserId) userId = runtimeUserId;
    } catch {
      // fall back
    }
  }

  const darInfos: Array<{
    path: string;
    bytes?: number;
    status?: number;
    body?: string;
    alreadyVetted?: true;
  }> = [];
  let darInfo: (typeof darInfos)[number] = { path: DAR_ASSET_PATH, status: 0 };
  for (const assetPath of DAR_ASSET_PATHS) {
    const darUrl = new URL(assetPath, opts.baseUrl).toString();
    const darRes = await fetch(darUrl);
    if (!darRes.ok) {
      return Response.json(
        { mode, step: "fetch-dar", url: darUrl, status: darRes.status },
        { status: 500 },
      );
    }
    const darBytes = await darRes.arrayBuffer();
    const uploadRes = await fetch(`${adminBase}/v2/dars`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/octet-stream" },
      body: darBytes,
    });
    const uploadText = await uploadRes.text();
    // 409 = duplicate package hash (exact same DAR already on-ledger) — safe.
    // KNOWN_PACKAGE_VERSION = a *different* DAR with the same name+version is
    // on-ledger. Treating this as success is dangerous: ledger keeps the old
    // package, `#nhs-budget` resolves to it, and any new templates we added
    // are invisible (TEMPLATES_OR_INTERFACES_NOT_FOUND at runtime). Fail loud.
    const exactDup = uploadRes.status === 409;
    const versionClash = uploadText.includes("KNOWN_PACKAGE_VERSION");
    if (!uploadRes.ok && !exactDup) {
      return Response.json(
        {
          mode,
          step: "upload-dar",
          dar: assetPath,
          status: uploadRes.status,
          body: uploadText.slice(0, 500),
          hint: versionClash
            ? "Ledger already has a *different* DAR at this name+version. Bump version in daml.yaml, rebuild, and redeploy."
            : undefined,
        },
        { status: 502 },
      );
    }
    darInfos.push({
      path: assetPath,
      bytes: darBytes.byteLength,
      status: uploadRes.status,
      body: uploadText.slice(0, 300),
      ...(exactDup ? { alreadyVetted: true as const } : {}),
    });
  }
  darInfo = darInfos[darInfos.length - 1]!;


  let synchronizerId: string | undefined;
  let synchronizerInfo: unknown = "skipped";
  if (mode === "devnet") {
    const { fetchConnectedSynchronizers, pickPrimarySynchronizerId } = await import(
      "@/lib/canton/synchronizers.server"
    );
    const sd = await fetchConnectedSynchronizers(ledgerBase, adminJwt);
    synchronizerInfo = sd;
    if (!sd.ok || sd.synchronizers.length === 0) {
      return Response.json(
        {
          mode,
          step: "discover-synchronizer",
          detail:
            "Validator participant has no connected synchronizer. Party allocation cannot register topology. Contact Seaport support.",
          synchronizerInfo: sd,
        },
        { status: 502 },
      );
    }
    synchronizerId = pickPrimarySynchronizerId(sd.synchronizers);
  }

  const { listParties, upsertParties } = await import("@/lib/canton/parties.server");
  const existingRows = await listParties().catch(() => []);
  const existing = new Map(existingRows.map((r) => [r.logical_name, r.party_id]));

  // Compute which parties we still need to resolve. We pre-load the
  // participant's already-hosted parties ONCE on Devnet (where re-allocating
  // an existing partyIdHint fails with "already allocated" and the truncated
  // error cause makes the suffix unrecoverable). This avoids per-hint
  // fallback fetches that would 502 on Cloudflare due to subrequest + CPU
  // budgets when /v2/parties returns ~10k parties.
  const missingHints = parties.filter((h) => !existing.has(h));

  let hostedByHint = new Map<string, string>();
  if (mode === "devnet" && missingHints.length > 0) {
    const missingSet = new Set(missingHints);
    let pageToken: string | undefined;
    for (let page = 0; page < 40 && missingSet.size > 0; page++) {
      const qs = new URLSearchParams({ pageSize: "2000" });
      if (pageToken) qs.set("pageToken", pageToken);
      const r = await fetch(`${adminBase}/v2/parties?${qs.toString()}`, { headers: auth });
      if (!r.ok) break;
      const j = (await r.json().catch(() => ({}))) as {
        partyDetails?: Array<{ party: string; isLocal?: boolean }>;
        nextPageToken?: string;
      };
      for (const p of j.partyDetails ?? []) {
        if (p.isLocal !== true) continue;
        const idx = p.party.indexOf("::");
        if (idx <= 0) continue;
        const hint = p.party.slice(0, idx);
        if (missingSet.has(hint) && !hostedByHint.has(hint)) {
          hostedByHint.set(hint, p.party);
          missingSet.delete(hint);
        }
      }
      if (!j.nextPageToken) break;
      pageToken = j.nextPageToken;
    }
  }

  const allocs: AllocResult[] = [];
  for (const hint of parties) {
    const known = existing.get(hint) ?? hostedByHint.get(hint);
    if (known) {
      allocs.push({ hint, partyId: known });
      continue;
    }
    try {
      const allocBody: Record<string, unknown> = { partyIdHint: hint };
      if (synchronizerId) allocBody.synchronizerId = synchronizerId;
      const res = await fetch(`${adminBase}/v2/parties`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(allocBody),
      });
      const json = (await res.json().catch(() => ({}))) as {
        partyDetails?: { party?: string };
        party?: string;
      };
      let partyId = json.partyDetails?.party ?? json.party;
      let allocErr: string | undefined;
      if (!res.ok) {
        const rawErr = JSON.stringify(json);
        allocErr = `status ${res.status}: ${rawErr.slice(0, 240)}`;
        if (res.status === 409 || res.status === 400) {
          const m = rawErr.match(
            new RegExp(`${hint.replace(/[-\\^$*+?.()|[\\]{}]/g, "\\\\$&")}::[0-9a-fA-F]+`),
          );
          if (m) partyId = m[0];
        }
      }
      if (!partyId) {
        allocs.push({ hint, error: allocErr ?? "no party id returned" });
        continue;
      }
      if (mode === "devnet") {
        const vr = await fetch(`${adminBase}/v2/parties/${encodeURIComponent(partyId)}`, {
          headers: auth,
        });
        const vt = await vr.text();
        let vj: { partyDetails?: Array<{ isLocal?: boolean }> } = {};
        try {
          vj = JSON.parse(vt);
        } catch {
          /* ignore */
        }
        const isLocal = vj.partyDetails?.[0]?.isLocal === true;
        if (!vr.ok || !isLocal) {
          allocs.push({
            hint,
            partyId,
            error: `not registered on synchronizer (isLocal=${isLocal}, lookup status ${vr.status})${allocErr ? `; allocate: ${allocErr}` : ""}`,
          });
          continue;
        }
      }
      allocs.push({ hint, partyId });
    } catch (e) {
      allocs.push({ hint, error: e instanceof Error ? e.message : "fetch-failed" });
    }
  }



  const failed = allocs.filter((a) => a.error);
  if (failed.length > 0) {
    return Response.json(
      {
        mode,
        step: "allocate-parties",
        detail:
          mode === "devnet"
            ? "One or more parties were not registered on the connected synchronizer. Existing party IDs were not persisted."
            : "One or more party allocations failed.",
        synchronizerId,
        allocs,
      },
      { status: 502 },
    );
  }

  const rowsToUpsert = allocs
    .filter((a): a is { hint: string; partyId: string } => !!a.partyId)
    .map((a) => ({ logical_name: a.hint, party_id: a.partyId }));
  try {
    await upsertParties(rowsToUpsert);
  } catch (e) {
    return Response.json(
      {
        mode,
        step: "persist-parties",
        detail: e instanceof Error ? e.message : String(e),
        allocs,
      },
      { status: 500 },
    );
  }

  const userRes = await fetch(`${adminBase}/v2/users`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      user: {
        id: userId,
        primaryParty: "",
        isDeactivated: false,
        metadata: { resourceVersion: "", annotations: {} },
        identityProviderId: "",
      },
    }),
  });
  const userBody = await userRes.text();
  const userCreated = userRes.ok || userRes.status === 409;
  if (!userCreated) {
    return Response.json(
      { mode, step: "create-user", status: userRes.status, body: userBody.slice(0, 800) },
      { status: 502 },
    );
  }

  // Canton caps the number of rights per user (TOO_MANY_USER_RIGHTS at ~1000).
  // On Seaport the runtime user is SHARED across all tenants that use the
  // same OIDC client (validator user "6" typically), so we must be surgical:
  //   (a) list existing rights,
  //   (b) revoke only rights that reference an OUR-namespaced party hint
  //       with a STALE fingerprint (leftover from prior deploys) — never
  //       touch rights belonging to other tenants,
  //   (c) POST only the rights actually missing for the current allocs.
  // Revocation uses PATCH /v2/users/{id}/rights per Canton JSON API 3.4
  // OpenAPI (RevokeUserRightsRequest); POST /rights is grant-only.
  const currentPartyIds = new Set(
    allocs.filter((a) => a.partyId).map((a) => a.partyId!),
  );
  const ourHintPrefixes = new Set(parties); // "DHSC", "NHSEngland", "ICB-NEY", ...
  const existingReadAs = new Set<string>();
  const existingActAs = new Set<string>();
  const staleRights: Array<{ kind: Record<string, { value: { party: string } }> }> = [];
  let totalRightsSeen = 0;
  try {
    const lr = await fetch(`${adminBase}/v2/users/${encodeURIComponent(userId)}/rights`, {
      headers: auth,
    });
    if (lr.ok) {
      const lj = (await lr.json().catch(() => ({}))) as {
        rights?: Array<{
          kind?: {
            CanActAs?: { value?: { party?: string } };
            CanReadAs?: { value?: { party?: string } };
          };
        }>;
      };
      const isOurStale = (partyId: string) => {
        if (currentPartyIds.has(partyId)) return false;
        const idx = partyId.indexOf("::");
        if (idx <= 0) return false;
        const hint = partyId.slice(0, idx);
        return ourHintPrefixes.has(hint);
      };
      for (const r of lj.rights ?? []) {
        totalRightsSeen++;
        const read = r.kind?.CanReadAs?.value?.party;
        const act = r.kind?.CanActAs?.value?.party;
        if (read) {
          if (currentPartyIds.has(read)) {
            existingReadAs.add(read);
            // CanActAs subsumes CanReadAs — this ReadAs on our current party
            // is redundant, mark for revocation to free cap space.
            staleRights.push({ kind: { CanReadAs: { value: { party: read } } } });
          } else if (isOurStale(read)) {
            staleRights.push({ kind: { CanReadAs: { value: { party: read } } } });
          }
        }
        if (act) {
          if (currentPartyIds.has(act)) existingActAs.add(act);
          else if (isOurStale(act))
            staleRights.push({ kind: { CanActAs: { value: { party: act } } } });
        }
      }
    }
  } catch {
    // Fall through — worst case we hit TOO_MANY_USER_RIGHTS surfaced below.
  }

  let revokeResult: unknown = "skipped";
  if (staleRights.length > 0) {
    let revoked = 0;
    let lastErr: { status: number; body: string } | undefined;
    for (let i = 0; i < staleRights.length; i += 100) {
      const chunk = staleRights.slice(i, i + 100);
      const rv = await fetch(
        `${adminBase}/v2/users/${encodeURIComponent(userId)}/rights`,
        {
          method: "PATCH",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ userId, identityProviderId: "", rights: chunk }),
        },
      );
      const rb = await rv.text();
      if (rv.ok) {
        revoked += chunk.length;
      } else {
        lastErr = { status: rv.status, body: rb.slice(0, 400) };
        break;
      }
    }
    revokeResult = { revoked, total: staleRights.length, lastErr, totalRightsSeen };
  } else {
    revokeResult = { revoked: 0, total: 0, totalRightsSeen };
  }

  // Grant only CanActAs (subsumes CanReadAs) for parties still missing it.
  // Keeps our footprint on the shared user at ~N instead of ~2N.
  const rights: Array<{ kind: Record<string, { value: { party: string } }> }> = [];
  for (const a of allocs) {
    if (!a.partyId) continue;
    if (!existingActAs.has(a.partyId)) {
      rights.push({ kind: { CanActAs: { value: { party: a.partyId } } } });
    }
  }


  let rightsResult: unknown = "skipped";
  if (rights.length > 0) {
    const r = await fetch(`${adminBase}/v2/users/${encodeURIComponent(userId)}/rights`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ userId, identityProviderId: "", rights }),
    });
    const rb = await r.text();
    rightsResult = { status: r.status, ok: r.ok, granted: rights.length, body: rb.slice(0, 800) };
    if (!r.ok && r.status !== 409) {
      return Response.json(
        { mode, step: "grant-rights", status: r.status, granted: rights.length, revokeResult, body: rb.slice(0, 800), allocs },
        { status: 502 },
      );
    }
  } else {
    rightsResult = { status: 200, ok: true, granted: 0, note: "all rights already present" };
  }



  let verify: { ok: boolean; status?: number; body?: string; error?: string };
  try {
    const runtimeJwt = await getRuntimeAccessToken();
    const vr = await fetch(`${ledgerBase}/v2/state/ledger-end`, {
      headers: { Authorization: `Bearer ${runtimeJwt}` },
    });
    const vb = await vr.text();
    verify = { ok: vr.ok, status: vr.status, body: vb.slice(0, 400) };
    if (!vr.ok) {
      return Response.json(
        { mode, step: "verify-runtime-user", verify, allocs, rightsResult },
        { status: 502 },
      );
    }
  } catch (e) {
    verify = { ok: false, error: e instanceof Error ? e.message : String(e) };
    return Response.json(
      { mode, step: "verify-runtime-user", verify, allocs, rightsResult },
      { status: 502 },
    );
  }

  let rightsVerify: {
    ok: boolean;
    listed: number;
    missingReadAs: string[];
    missingActAs: string[];
    error?: string;
  } = { ok: true, listed: 0, missingReadAs: [], missingActAs: [] };
  try {
    const lr = await fetch(`${adminBase}/v2/users/${encodeURIComponent(userId)}/rights`, {
      headers: auth,
    });
    const lj = (await lr.json().catch(() => ({}))) as {
      rights?: Array<{
        kind?: {
          CanActAs?: { value?: { party?: string } };
          CanReadAs?: { value?: { party?: string } };
        };
      }>;
    };
    const readSet = new Set<string>();
    const actSet = new Set<string>();
    for (const r of lj.rights ?? []) {
      const read = r.kind?.CanReadAs?.value?.party;
      const act = r.kind?.CanActAs?.value?.party;
      if (read) readSet.add(read);
      if (act) actSet.add(act);
    }
    const missingReadAs: string[] = [];
    const missingActAs: string[] = [];
    for (const a of allocs) {
      if (!a.partyId) continue;
      if (!readSet.has(a.partyId)) missingReadAs.push(a.hint);
      if (!actSet.has(a.partyId)) {
        missingActAs.push(a.hint);
      }
    }
    rightsVerify = {
      ok: lr.ok && missingReadAs.length === 0 && missingActAs.length === 0,
      listed: (lj.rights ?? []).length,
      missingReadAs,
      missingActAs,
    };
    if (!rightsVerify.ok) {
      return Response.json(
        { mode, step: "verify-rights", rightsVerify, rightsResult, allocs },
        { status: 502 },
      );
    }
  } catch (e) {
    rightsVerify = {
      ok: false,
      listed: 0,
      missingReadAs: [],
      missingActAs: [],
      error: e instanceof Error ? e.message : String(e),
    };
    return Response.json(
      { mode, step: "verify-rights", rightsVerify, allocs, rightsResult },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    mode,
    endpoints: { ledgerApi: ledgerBase, adminApi: adminBase },
    synchronizerId,
    synchronizerInfo,
    dar: darInfo,
    dars: darInfos,
    parties: allocs,
    user: {
      id: userId,
      derivedFromToken: runtimeUserId,
      created: userCreated,
      createStatus: userRes.status,
      createBody: userBody.slice(0, 400),
      rights: rightsResult,
    },
    verify,
    rightsVerify,
  });
}
