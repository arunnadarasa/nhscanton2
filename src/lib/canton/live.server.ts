// Live Canton JSON Ledger API v2 client (Canton 3.4+).
// Docs: https://docs.digitalasset.com/build/3.4/explanations/json-api/index.html
//
// Pure raw-fetch implementation. We previously routed reads through
// @canton-network/wallet-sdk but that package is not compatible with our
// Cloudflare Worker SSR runtime ("ReferenceError: require is not defined"
// when bundled). Both reads and writes now go straight to the JSON API.

import type { Contract, Party, SpendCommitment, ReconciledSpend, TemplateName } from "./types";
import { getRuntimeAccessToken, getRuntimeLedgerUserId } from "./tokens.server";
import { resolveParty, resolvePayloadParties } from "./parties.server";
import { cantonEnv } from "./mode.server";

async function userId() {
  return getRuntimeLedgerUserId();
}

function endpoint() {
  const url = cantonEnv("JSON_API_URL");
  if (!url) throw new Error("Canton live endpoint not configured");
  return { url: url.replace(/\/$/, "") };
}

async function http<T>(path: string, init: RequestInit): Promise<T> {
  const { url } = endpoint();
  const jwt = await getRuntimeAccessToken();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // Auto-fallback: clear the network cookie so the next request runs on
    // Memo instead of repeatedly hitting a dead endpoint.
    try {
      const { deleteCookie } = await import("@tanstack/react-start/server");
      deleteCookie("canton_network", { path: "/" });
    } catch {
      // not in a request context — ignore
    }
    throw new Error(
      `Canton ledger at ${url} is offline (${reason}). Reverted to Memo mode — refresh the page to continue the demo.`,
    );
  }
  if (!res.ok) {
    throw new Error(`Canton ${path} ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

function newCommandId() {
  return `lovable-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function v2TemplateId(t: TemplateName): string {
  return `#nhs-budget-app-v2:${t}`;
}

function usdcxTemplateId(): string {
  // Default to the Daml-LF package-name reference for our mock-usdcx DAR.
  // JSON Ledger API v2 resolves `#<package-name>` to the latest uploaded
  // version, so no explicit hash is required for the demo.
  const pkg = cantonEnv("USDCX_PACKAGE_ID") ?? "#mock-usdcx";
  const tpl = cantonEnv("USDCX_TEMPLATE") ?? "MockUsdcx:Holding";
  return `${pkg}:${tpl}`;
}

export function isUsdcxConfigured(): boolean {
  // mock-usdcx ships in our self-deployed DAR set, so USDCx is always
  // available once self-deploy has run. Operators can still override with
  // CANTON_USDCX_PACKAGE_ID / CANTON_USDCX_TEMPLATE for real xReserve.
  return true;
}

type SubmitAndWaitResponse = {
  completionOffset?: string;
  transaction?: {
    events?: Array<{
      CreatedEvent?: {
        contractId: string;
        templateId: string;
        createArgument: unknown;
        signatories: Party[];
        observers: Party[];
        createdAt?: string;
      };
      ExercisedEvent?: {
        contractId: string;
        templateId: string;
        choice: string;
        exerciseResult: unknown;
      };
    }>;
  };
};

async function submitAndWait(actAs: Party, commands: unknown[]): Promise<SubmitAndWaitResponse> {
  const resolved = await resolveParty(actAs);
  return http<SubmitAndWaitResponse>("/v2/commands/submit-and-wait-for-transaction", {
    method: "POST",
    body: JSON.stringify({
      commands: {
        commands,
        userId: await userId(),
        commandId: newCommandId(),
        actAs: [resolved],
        readAs: [],
      },
    }),
  });
}

function firstCreated(res: SubmitAndWaitResponse) {
  const ev = res.transaction?.events?.find((e) => e.CreatedEvent)?.CreatedEvent;
  if (!ev) throw new Error("Canton: no CreatedEvent in transaction");
  return ev;
}

function firstExercised(res: SubmitAndWaitResponse) {
  const ev = res.transaction?.events?.find((e) => e.ExercisedEvent)?.ExercisedEvent;
  if (!ev) throw new Error("Canton: no ExercisedEvent in transaction");
  return ev;
}

export async function liveCreate<P>(
  templateId: TemplateName,
  payload: P,
  actAs: Party,
): Promise<Contract<P>> {
  const resolvedPayload = await resolvePayloadParties(payload as Record<string, unknown>);
  const res = await submitAndWait(actAs, [
    { CreateCommand: { templateId: v2TemplateId(templateId), createArguments: resolvedPayload } },
  ]);
  const ev = firstCreated(res);
  return {
    contractId: ev.contractId,
    templateId,
    payload: (ev.createArgument as P) ?? payload,
    signatories: ev.signatories,
    observers: ev.observers,
    createdAt: ev.createdAt ?? new Date().toISOString(),
  };
}

export async function liveExercise<R>(
  templateId: TemplateName,
  contractId: string,
  choice: string,
  argument: unknown,
  actAs: Party,
): Promise<R> {
  const submitter = actAs;
  const res = await submitAndWait(submitter, [
    {
      ExerciseCommand: {
        templateId: v2TemplateId(templateId),
        contractId,
        choice,
        choiceArgument: argument,
      },
    },
  ]);
  const created = res.transaction?.events?.find((e) => e.CreatedEvent)?.CreatedEvent;
  if (created) return created.contractId as unknown as R;
  return firstExercised(res).exerciseResult as R;
}

// --- Raw active-contracts read --------------------------------------------

type LedgerEndResponse = { offset: number | string };

export async function liveLedgerEnd(): Promise<number> {
  const r = await http<LedgerEndResponse>("/v2/state/ledger-end", { method: "GET" });
  const n = typeof r.offset === "string" ? Number(r.offset) : r.offset;
  return Number.isFinite(n) ? n : 0;
}

export async function livePing(): Promise<{ offset: string }> {
  const offset = await liveLedgerEnd();
  return { offset: String(offset) };
}

type JsActiveContract = {
  createdEvent: {
    contractId: string;
    templateId: string;
    createArgument: unknown;
    signatories: Party[];
    observers?: Party[];
    createdAt?: string;
  };
};
type ActiveContractEntry = {
  contractEntry: { JsActiveContract?: JsActiveContract };
};

async function rawActiveContracts(
  templateId: string,
  party: string,
): Promise<JsActiveContract["createdEvent"][]> {
  const offset = await liveLedgerEnd();
  const body = {
    eventFormat: {
      filtersByParty: {
        [party]: {
          cumulative: [
            {
              identifierFilter: {
                TemplateFilter: {
                  value: { templateId, includeCreatedEventBlob: false },
                },
              },
            },
          ],
        },
      },
      verbose: false,
    },
    verbose: false,
    activeAtOffset: offset,
  };
  const res = await http<ActiveContractEntry[] | { contracts?: ActiveContractEntry[] }>(
    "/v2/state/active-contracts",
    { method: "POST", body: JSON.stringify(body) },
  );
  const arr = Array.isArray(res) ? res : (res.contracts ?? []);
  const out: JsActiveContract["createdEvent"][] = [];
  for (const item of arr) {
    const c = item?.contractEntry?.JsActiveContract?.createdEvent;
    if (c) out.push(c);
  }
  return out;
}

export async function liveQuery<P>(
  templateId: TemplateName,
  readAs: Party,
): Promise<Contract<P>[]> {
  const resolved = await resolveParty(readAs);
  const events = await rawActiveContracts(v2TemplateId(templateId), resolved);
  return events.map((c) => ({
    contractId: c.contractId,
    templateId,
    payload: c.createArgument as P,
    signatories: c.signatories,
    observers: c.observers ?? [],
    createdAt: c.createdAt ?? new Date().toISOString(),
  }));
}

// --- USDCx (DevNet) --------------------------------------------------------

function usdcxIssuer(): Party {
  return (
    cantonEnv("USDCX_ISSUER") ??
    process.env.CANTON_PARTY_AUDITOR ??
    "Auditor"
  );
}

export async function liveUsdcxBalance(party: Party): Promise<number> {
  if (!isUsdcxConfigured()) return 0;
  const resolved = await resolveParty(party);
  const events = await rawActiveContracts(usdcxTemplateId(), resolved);
  return events.reduce((sum, c) => {
    const arg = (c.createArgument ?? {}) as { amount?: string | number; owner?: string };
    if (arg.owner && arg.owner !== resolved) return sum;
    const n = typeof arg.amount === "string" ? parseFloat(arg.amount) : Number(arg.amount ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/**
 * Mint a mock-USDCx Holding for `owner`. Submitted as the configured
 * issuer (defaults to the Auditor party). Only works against the
 * mock-usdcx package — real xReserve USDCx is faucet-issued.
 */
export async function liveMintMockUsdcx(
  owner: Party,
  amount: number | string,
): Promise<{ contractId: string; amount: string; owner: string; issuer: string }> {
  // isUsdcxConfigured() is always true now (mock-usdcx ships in our DAR set)
  const issuer = usdcxIssuer();
  const issuerResolved = await resolveParty(issuer);
  const ownerResolved = await resolveParty(owner);
  const amt = typeof amount === "string" ? amount : amount.toFixed(2);
  const res = await submitAndWait(issuer, [
    {
      CreateCommand: {
        templateId: usdcxTemplateId(),
        createArguments: {
          issuer: issuerResolved,
          owner: ownerResolved,
          amount: amt,
        },
      },
    },
  ]);
  const ev = firstCreated(res);
  return {
    contractId: ev.contractId,
    amount: amt,
    owner: ownerResolved,
    issuer: issuerResolved,
  };
}


export async function liveSettle(
  commitment: Contract<SpendCommitment>,
  holdingCid: string,
  supplierParty: Party,
): Promise<{ reconciled: Contract<ReconciledSpend>; settlementTxId: string }> {
  if (!isUsdcxConfigured()) throw new Error("USDCx not configured on this participant");
  const supplierId = await resolveParty(supplierParty);
  const res = await submitAndWait(commitment.payload.commissioner, [
    {
      ExerciseCommand: {
        templateId: v2TemplateId("Nhs:SpendCommitment"),
        contractId: commitment.contractId,
        choice: "SettleAndCountersign",
        choiceArgument: { holdingCid, supplierParty: supplierId },
      },
    },
  ]);
  const offset = res.completionOffset ?? "";
  const created = res.transaction?.events?.find((e) => e.CreatedEvent)?.CreatedEvent;
  if (!created) throw new Error("liveSettle: no CreatedEvent for ReconciledSpend");
  const payload = (created.createArgument as ReconciledSpend) ?? {
    ...commitment.payload,
    supplierName: commitment.payload.supplierName ?? supplierId,
    settlementTxId: offset,
  };
  return {
    reconciled: {
      contractId: created.contractId,
      templateId: "Nhs:ReconciledSpend",
      payload: { ...payload, settlementTxId: offset },
      signatories: created.signatories,
      observers: created.observers,
      createdAt: created.createdAt ?? new Date().toISOString(),
    },
    settlementTxId: offset,
  };
}
