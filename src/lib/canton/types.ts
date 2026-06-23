// Shared Canton/Daml DTO types. Mirror the Daml templates in daml/Nhs.daml.
// Decimal is serialised as string over the JSON Ledger API.

export type Party = string;
export type ContractId = string;
export type Decimal = string; // numeric string, e.g. "192300000000.00"

export type TemplateName =
  | "Nhs:BudgetAllocation"
  | "Nhs:SpendCommitment"
  | "Nhs:ReconciledSpend"
  | "Nhs:Invoice";

export interface BudgetAllocation {
  allocator: Party;
  recipient: Party;
  fiscalYear: string;
  amountGbp: Decimal;
  purpose: string;
}

export interface SpendCommitment {
  trust: Party;
  commissioner: Party;
  auditor: Party;
  category: string;
  amountGbp: Decimal;
  period: string;
  // Optional supplier — when set, this commitment is settleable via USDCx.
  supplier?: Party | null;
  // Optional payment amount in USDCx units. Defaults to amountGbp 1:1 in the demo.
  paymentAmount?: Decimal | null;
}

export interface ReconciledSpend {
  trust: Party;
  commissioner: Party;
  auditor: Party;
  category: string;
  amountGbp: Decimal;
  period: string;
  supplier?: Party | null;
  // Transaction id / completion offset from the USDCx transfer leg, when settled.
  settlementTxId?: string | null;
}

export interface Invoice {
  trust: Party;
  commissioner: Party;
  auditor: Party;
  invoiceRef: string;
  category: string;
  amountGbp: Decimal;
  period: string;
  supplier?: Party | null;
}

export interface Contract<P = unknown> {
  contractId: ContractId;
  templateId: TemplateName;
  payload: P;
  signatories: Party[];
  observers: Party[];
  createdAt: string;
}

// USDCx (wrapped USDC on Canton DevNet — xReserve programme).
// Docs: https://docs.digitalasset.com/integrate/devnet/usdcx-support/index.html
export interface UsdcxHolding {
  contractId: ContractId;
  owner: Party;
  amount: Decimal;
}

export interface LedgerMode {
  mode: "live" | "memory";
  network?: "memory" | "localnet" | "devnet";
  endpoint?: string;
  // Whether USDCx wrapped-USDC settlement is wired up. In memory mode this is
  // always "simulated"; in live mode it depends on CANTON_USDCX_PACKAGE_ID.
  usdcx: "configured" | "not-configured" | "simulated";
  // Which networks the operator has wired up secrets for. Drives the
  // header pill: disabled options show a tooltip explaining what's missing.
  available?: { memory: true; fly: boolean; seaport: boolean };
}

