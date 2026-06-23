// In-process Canton ledger that mimics the JSON Ledger API surface we use.
// Enforces signatory/observer disclosure so privacy behaviour matches a real
// participant: queries only return contracts the requesting party can see.

import type {
  BudgetAllocation,
  Contract,
  Invoice,
  Party,
  ReconciledSpend,
  SpendCommitment,
  TemplateName,
} from "./types";

type AnyContract = Contract<BudgetAllocation | SpendCommitment | ReconciledSpend | Invoice>;

// Module-level singleton. Survives across server fn invocations within a
// single Worker isolate — exactly the demo lifetime we need.
const g = globalThis as unknown as {
  __nhsLedger?: AnyContract[];
  __nhsUsdcx?: Map<Party, number>;
};
if (!g.__nhsLedger) g.__nhsLedger = [];
if (!g.__nhsUsdcx) g.__nhsUsdcx = new Map();
const store = g.__nhsLedger;
const usdcx = g.__nhsUsdcx;

let counter = 0;
const nextCid = () => `cid-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function disclosed(c: AnyContract, party: Party): boolean {
  return c.signatories.includes(party) || c.observers.includes(party);
}

export function memCreate<T extends BudgetAllocation | SpendCommitment | ReconciledSpend | Invoice>(
  templateId: TemplateName,
  payload: T,
  signatories: Party[],
  observers: Party[],
): Contract<T> {
  const contract: Contract<T> = {
    contractId: nextCid(),
    templateId,
    payload,
    signatories,
    observers,
    createdAt: new Date().toISOString(),
  };
  store.push(contract as unknown as AnyContract);
  return contract;
}

export function memQuery<T = unknown>(
  templateId: TemplateName,
  party: Party,
): Contract<T>[] {
  return store
    .filter((c) => c.templateId === templateId && disclosed(c, party))
    .map((c) => c as unknown as Contract<T>);
}

export function memArchive(cid: string) {
  const i = store.findIndex((c) => c.contractId === cid);
  if (i >= 0) store.splice(i, 1);
}

export function memAll(): AnyContract[] {
  return [...store];
}

export function memReset() {
  store.length = 0;
  usdcx.clear();
}

// --- USDCx pool (simulated) ------------------------------------------------
// Every Trust party starts with £200m of demo USDCx so the settlement flow
// works out of the box with no env config.
const SEED_TRUST_BALANCE = 200_000_000;

export function memUsdcxBalance(party: Party): number {
  if (!usdcx.has(party) && party.startsWith("Trust::")) {
    usdcx.set(party, SEED_TRUST_BALANCE);
  }
  return usdcx.get(party) ?? 0;
}

export function memUsdcxSettle(
  commitment: Contract<SpendCommitment>,
  supplier: Party,
): { reconciled: Contract<ReconciledSpend>; settlementTxId: string } {
  const trust = commitment.payload.trust;
  const amount = parseFloat(
    commitment.payload.paymentAmount ?? commitment.payload.amountGbp,
  );
  const bal = memUsdcxBalance(trust);
  if (bal < amount) {
    throw new Error(
      `Trust ${trust} has insufficient USDCx (${bal} < ${amount})`,
    );
  }
  usdcx.set(trust, bal - amount);
  usdcx.set(supplier, (usdcx.get(supplier) ?? 0) + amount);

  const reconciled = memCreate<ReconciledSpend>(
    "Nhs:ReconciledSpend",
    {
      trust: commitment.payload.trust,
      commissioner: commitment.payload.commissioner,
      auditor: commitment.payload.auditor,
      category: commitment.payload.category,
      amountGbp: commitment.payload.amountGbp,
      period: commitment.payload.period,
      supplier,
      settlementTxId: `sim-tx-${Date.now().toString(36)}`,
    },
    [commitment.payload.trust, commitment.payload.commissioner],
    [commitment.payload.auditor, supplier],
  );
  memArchive(commitment.contractId);
  return {
    reconciled,
    settlementTxId: reconciled.payload.settlementTxId ?? "sim-tx",
  };
}
