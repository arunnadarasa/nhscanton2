// GET /api/public/admin/diagnose
//
// Token-gated read-only diagnostics for the active Canton network.
// Surfaces: mode, endpoints, OIDC/admin token mint result, connected
// synchronizers, /v2/parties listing, and per-persisted-party lookups.
//
// Use after running /api/public/admin/deploy on Devnet to confirm parties
// were actually registered with the global synchronizer (otherwise ledger
// commands hit UNKNOWN_INFORMEES).

import { createFileRoute } from "@tanstack/react-router";

import { getCantonEndpoints, getCantonMode } from "@/lib/canton/mode.server";

export const Route = createFileRoute("/api/public/admin/diagnose")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const adminToken = process.env.DEPLOY_ADMIN_TOKEN;
        const mode = getCantonMode();
        const { ledgerApi, adminApi } = getCantonEndpoints();
        if (!adminToken) {
          return Response.json({ error: "DEPLOY_ADMIN_TOKEN not set" }, { status: 500 });
        }
        if (request.headers.get("x-deploy-token") !== adminToken) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (mode === "memory" || !ledgerApi) {
          return Response.json({ mode, note: "memory mode — nothing to diagnose" });
        }

        const ledgerBase = ledgerApi.replace(/\/+$/, "");
        const adminBase = (adminApi ?? ledgerApi).replace(/\/+$/, "");

        // 1. Mint admin token.
        const { getAdminAccessToken } = await import("@/lib/canton/tokens.server");
        let adminJwt: string;
        try {
          adminJwt = await getAdminAccessToken();
        } catch (e) {
          return Response.json(
            {
              mode,
              endpoints: { ledgerBase, adminBase },
              tokenMint: { ok: false, error: e instanceof Error ? e.message : String(e) },
            },
            { status: 500 },
          );
        }
        const auth = { Authorization: `Bearer ${adminJwt}` };

        // 2. Connected synchronizers.
        const { fetchConnectedSynchronizers } = await import(
          "@/lib/canton/synchronizers.server"
        );
        const syncResult = await fetchConnectedSynchronizers(ledgerBase, adminJwt);

        // 3. /v2/parties listing.
        let partiesList: unknown = "skipped";
        try {
          const lr = await fetch(`${adminBase}/v2/parties`, { headers: auth });
          const txt = await lr.text();
          let parsed: { partyDetails?: Array<{ party: string; isLocal?: boolean }> } = {};
          try {
            parsed = JSON.parse(txt);
          } catch {
            // ignore
          }
          partiesList = {
            ok: lr.ok,
            status: lr.status,
            count: parsed.partyDetails?.length ?? 0,
            sample: (parsed.partyDetails ?? []).slice(0, 50),
            raw: lr.ok ? undefined : txt.slice(0, 500),
          };
        } catch (e) {
          partiesList = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }

        // 4. Per-persisted-party lookup.
        let persisted: Array<{
          hint: string;
          partyId: string;
          lookup: { ok: boolean; status: number; isLocal?: boolean; body?: string };
        }> = [];
        try {
          const { listParties } = await import("@/lib/canton/parties.server");
          const rows = await listParties();
          persisted = await Promise.all(
            rows.map(async (row) => {
              try {
                const r = await fetch(
                  `${adminBase}/v2/parties/${encodeURIComponent(row.party_id)}`,
                  { headers: auth },
                );
                const t = await r.text();
                let body: { partyDetails?: Array<{ isLocal?: boolean }> } = {};
                try {
                  body = JSON.parse(t);
                } catch {
                  // ignore
                }
                return {
                  hint: row.logical_name,
                  partyId: row.party_id,
                  lookup: {
                    ok: r.ok,
                    status: r.status,
                    isLocal: body.partyDetails?.[0]?.isLocal,
                    body: r.ok ? undefined : t.slice(0, 300),
                  },
                };
              } catch (e) {
                return {
                  hint: row.logical_name,
                  partyId: row.party_id,
                  lookup: { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) },
                };
              }
            }),
          );
        } catch (e) {
          return Response.json(
            {
              mode,
              endpoints: { ledgerBase, adminBase },
              syncResult,
              partiesList,
              persistedError: e instanceof Error ? e.message : String(e),
            },
            { status: 500 },
          );
        }

        return Response.json({
          mode,
          endpoints: { ledgerBase, adminBase },
          tokenMint: { ok: true },
          connectedSynchronizers: syncResult,
          partiesList,
          persistedParties: persisted,
        });
      },
    },
  },
});
