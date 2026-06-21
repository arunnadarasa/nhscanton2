// Canton ledger client adapter. Switches between live JSON Ledger API and
// the in-memory demo ledger based on env vars. Same surface either way.

import { getCantonEndpoints, getCantonMode, getNetworkAvailability } from "./mode.server";

import {
  isUsdcxConfigured,
  liveCreate,
  liveExercise,
  liveQuery,
  liveSettle,
  liveUsdcxBalance,
} from "./live.server";
import {
  memAll,
  memArchive,
  memCreate,
  memQuery,
  memUsdcxBalance,
  memUsdcxSettle,
} from "./memory.server";
import type {
  BudgetAllocation,
  Contract,
  LedgerMode,
  Party,
  ReconciledSpend,
  SpendCommitment,
} from "./types";

export function ledgerMode(): LedgerMode {
  const network = getCantonMode();
  const { ledgerApi } = getCantonEndpoints();
  const available = getNetworkAvailability();
  if (network !== "memory" && ledgerApi) {
    return {
      mode: "live",
      network,
      endpoint: ledgerApi,
      usdcx: isUsdcxConfigured() ? "configured" : "not-configured",
      available,
    };
  }
  return { mode: "memory", network: "memory", usdcx: "simulated", available };
}

const isLive = () => ledgerMode().mode === "live";


// --- BudgetAllocation -------------------------------------------------------

export async function createAllocation(
  payload: BudgetAllocation,
): Promise<Contract<BudgetAllocation>> {
  if (isLive()) return liveCreate("Nhs:BudgetAllocation", payload, payload.allocator);
  return memCreate("Nhs:BudgetAllocation", payload, [payload.allocator], [payload.recipient]);
}

export async function subAllocate(
  parent: Contract<BudgetAllocation>,
  toParty: Party,
  amount: string,
  subPurpose: string,
): Promise<Contract<BudgetAllocation>> {
  if (isLive()) {
    const cid = await liveExercise<string>(
      "Nhs:BudgetAllocation",
      parent.contractId,
      "SubAllocate",
      { toParty, amount, subPurpose },
    );
    return {
      contractId: cid,
      templateId: "Nhs:BudgetAllocation",
      payload: {
        allocator: parent.payload.recipient,
        recipient: toParty,
        fiscalYear: parent.payload.fiscalYear,
        amountGbp: amount,
        purpose: subPurpose,
      },
      signatories: [parent.payload.recipient],
      observers: [toParty],
      createdAt: new Date().toISOString(),
    };
  }
  return memCreate(
    "Nhs:BudgetAllocation",
    {
      allocator: parent.payload.recipient,
      recipient: toParty,
      fiscalYear: parent.payload.fiscalYear,
      amountGbp: amount,
      purpose: subPurpose,
    },
    [parent.payload.recipient],
    [toParty],
  );
}

export async function queryAllocations(party: Party): Promise<Contract<BudgetAllocation>[]> {
  if (isLive()) {
    try { return await liveQuery<BudgetAllocation>("Nhs:BudgetAllocation", party); }
    catch (e) { console.warn("[canton] queryAllocations failed:", e); return []; }
  }
  return memQuery<BudgetAllocation>("Nhs:BudgetAllocation", party);
}

// --- SpendCommitment --------------------------------------------------------

export async function createSpendCommitment(
  payload: SpendCommitment,
): Promise<Contract<SpendCommitment>> {
  const observers = [payload.commissioner];
  if (payload.supplier) observers.push(payload.supplier);
  if (isLive()) return liveCreate("Nhs:SpendCommitment", payload, payload.trust);
  return memCreate("Nhs:SpendCommitment", payload, [payload.trust], observers);
}

export async function countersign(
  commitment: Contract<SpendCommitment>,
): Promise<Contract<ReconciledSpend>> {
  if (isLive()) {
    const cid = await liveExercise<string>(
      "Nhs:SpendCommitment",
      commitment.contractId,
      "Countersign",
      {},
    );
    return {
      contractId: cid,
      templateId: "Nhs:ReconciledSpend",
      payload: { ...commitment.payload },
      signatories: [commitment.payload.trust, commitment.payload.commissioner],
      observers: [commitment.payload.auditor],
      createdAt: new Date().toISOString(),
    };
  }
  const reconciled = memCreate(
    "Nhs:ReconciledSpend",
    { ...commitment.payload },
    [commitment.payload.trust, commitment.payload.commissioner],
    [commitment.payload.auditor],
  );
  memArchive(commitment.contractId);
  return reconciled;
}

export async function querySpendCommitments(party: Party): Promise<Contract<SpendCommitment>[]> {
  if (isLive()) {
    try { return await liveQuery<SpendCommitment>("Nhs:SpendCommitment", party); }
    catch (e) { console.warn("[canton] querySpendCommitments failed:", e); return []; }
  }
  return memQuery<SpendCommitment>("Nhs:SpendCommitment", party);
}

export async function queryReconciledSpend(party: Party): Promise<Contract<ReconciledSpend>[]> {
  if (isLive()) {
    try { return await liveQuery<ReconciledSpend>("Nhs:ReconciledSpend", party); }
    catch (e) { console.warn("[canton] queryReconciledSpend failed:", e); return []; }
  }
  return memQuery<ReconciledSpend>("Nhs:ReconciledSpend", party);
}

// --- USDCx Settlement (DevNet) ---------------------------------------------

export async function usdcxBalance(party: Party): Promise<number> {
  if (isLive()) return liveUsdcxBalance(party);
  return memUsdcxBalance(party);
}

export async function settleWithUsdcx(
  commitment: Contract<SpendCommitment>,
  opts: { supplier: Party; holdingCid?: string },
): Promise<{ reconciled: Contract<ReconciledSpend>; settlementTxId: string }> {
  if (isLive()) {
    if (!opts.holdingCid) {
      throw new Error("liveSettle requires a USDCx Holding contractId");
    }
    return liveSettle(commitment, opts.holdingCid, opts.supplier);
  }
  return memUsdcxSettle(commitment, opts.supplier);
}

// --- Explorer (demo only — bypasses privacy, used on /ledger) --------------

async function safeLiveQuery<T>(
  fn: () => Promise<Contract<T>[]>,
  label: string,
): Promise<Contract<T>[]> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // PERMISSION_DENIED is expected for parties the runtime user wasn't
    // granted rights on (e.g. between bootstrap runs). Don't spam warn.
    if (/PERMISSION_DENIED|do not authorize/i.test(msg)) {
      console.debug(`[canton] ${label} not authorized, skipping`);
    } else {
      console.warn(`[canton] live ${label} failed, returning []:`, err);
    }
    return [];
  }
}

export async function allContractsForExplorer() {
  if (isLive()) {
    const { ICBS, TRUSTS, partyAuditor, partyDhsc, partyIcb, partyNhsE, partyTrust } =
      await import("@/lib/nhs/data");
    const parties = Array.from(
      new Set<string>([
        partyDhsc(),
        partyNhsE(),
        partyAuditor(),
        ...ICBS.map((i) => partyIcb(i.code)),
        ...TRUSTS.map((t) => partyTrust(t.code)),
      ]),
    );
    const results = await Promise.all(
      parties.flatMap((p) => [
        safeLiveQuery(() => liveQuery<BudgetAllocation>("Nhs:BudgetAllocation", p), `BudgetAllocation@${p}`),
        safeLiveQuery(() => liveQuery<SpendCommitment>("Nhs:SpendCommitment", p), `SpendCommitment@${p}`),
        safeLiveQuery(() => liveQuery<ReconciledSpend>("Nhs:ReconciledSpend", p), `ReconciledSpend@${p}`),
      ]),
    );
    const seen = new Set<string>();
    const merged: Contract<BudgetAllocation | SpendCommitment | ReconciledSpend>[] = [];
    for (const list of results) {
      for (const c of list) {
        if (seen.has(c.contractId)) continue;
        seen.add(c.contractId);
        merged.push(c);
      }
    }
    return merged;
  }
  return memAll();
}
