// Hand-maintained registry of Daml templates exposed in the generic
// "Create Contract" UI. Mirrors daml/Nhs.daml and
// daml/NhsTokenisedBudgetAllocation.daml.
//
// The privacy flow (BudgetAllocationPrivacy → SpendCommitmentPrivacy →
// ReconciledSpendPrivacy) replaces the original Nhs:* templates in the
// generic form. Tokenisation and proof templates are added alongside.
// The original Nhs:BudgetAllocation / Nhs:SpendCommitment / Nhs:ReconciledSpend
// still exist in the DAR — they back the curated end-to-end workflow pages
// (allocations, trust, icb) — but are no longer part of the generic form.
//
// `kind` drives the form input type and the Zod validation built in
// `contracts.functions.ts`.

export type FieldKind = "party" | "text" | "numeric" | "hash";

export interface TemplateField {
  name: string;
  kind: FieldKind;
  required: boolean;
  /** True if the underlying Daml field is wrapped in `Optional`. Drives JSON encoding. */
  optional?: boolean;
  placeholder?: string;
  help?: string;
  /**
   * For `kind: "hash"`, the name of the sibling text field whose value is
   * hashed (identity for now — mirrors the Daml `hashText` implementation).
   * If the sibling is blank, this field is omitted.
   */
  derivedFrom?: string;
}

export type TemplateCategory = "privacy" | "tokenisation" | "proofs" | "invoice";

export interface TemplateDef {
  id: TemplateId;
  label: string;
  module: string; // e.g. "NhsTokenisedBudgetAllocation"
  category: TemplateCategory;
  fields: readonly TemplateField[];
  /** Logical-name hint of the party that should submit (actAs) by default. */
  defaultActAs?: string;
  /** One-line description shown in the template picker. */
  description?: string;
}

export type TemplateId =
  // Privacy flow
  | "NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy"
  | "NhsTokenisedBudgetAllocation:SpendCommitmentPrivacy"
  | "NhsTokenisedBudgetAllocation:ReconciledSpendPrivacy"
  // Tokenisation
  | "NhsTokenisedBudgetAllocation:TokenisationRequest"
  | "NhsTokenisedBudgetAllocation:NhsFundingToken"
  | "NhsTokenisedBudgetAllocation:TokenRedemption"
  // Proofs & private settlement
  | "NhsTokenisedBudgetAllocation:PrivateSettlement"
  | "NhsTokenisedBudgetAllocation:ProofOfAmount"
  | "NhsTokenisedBudgetAllocation:ProofOfSupplier"
  // Parallel invoice workflow (Nhs module — unchanged)
  | "Nhs:Invoice";

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  // ── Privacy flow ─────────────────────────────────────────────
  "NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy": {
    id: "NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy",
    label: "NHS:BudgetAllocationPrivacy",
    module: "NhsTokenisedBudgetAllocation",
    category: "privacy",
    defaultActAs: "DHSC",
    description: "Privacy-enhanced allocation with a hashed purpose commitment.",
    fields: [
      { name: "allocator", kind: "party", required: true },
      { name: "recipient", kind: "party", required: true },
      { name: "fiscalYear", kind: "text", required: true, placeholder: "2026-27" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "1000000.00" },
      { name: "purpose", kind: "text", required: true, placeholder: "ICB block contract" },
      {
        name: "purposeHash",
        kind: "hash",
        required: true,
        derivedFrom: "purpose",
        help: "Auto-derived from purpose (identity hash — matches Daml hashText).",
      },
    ],
  },
  "NhsTokenisedBudgetAllocation:SpendCommitmentPrivacy": {
    id: "NhsTokenisedBudgetAllocation:SpendCommitmentPrivacy",
    label: "NHS:SpendCommitmentPrivacy",
    module: "NhsTokenisedBudgetAllocation",
    category: "privacy",
    defaultActAs: "Trust-GSTT",
    description: "Trust spend line with hashed amount + optional supplier commitment.",
    fields: [
      { name: "trust", kind: "party", required: true },
      { name: "commissioner", kind: "party", required: true },
      { name: "auditor", kind: "party", required: true },
      { name: "category", kind: "text", required: true, placeholder: "acute" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "42500.00" },
      {
        name: "amountCommit",
        kind: "hash",
        required: true,
        derivedFrom: "amountGbp",
        help: "Auto-derived from amountGbp.",
      },
      { name: "period", kind: "text", required: true, placeholder: "2026-04" },
      { name: "supplier", kind: "party", required: false, optional: true },
      {
        name: "supplierCommit",
        kind: "hash",
        required: false,
        optional: true,
        derivedFrom: "supplier",
        help: "Auto-derived from supplier party id (if provided).",
      },
      { name: "paymentAmount", kind: "numeric", required: false, optional: true },
    ],
  },
  "NhsTokenisedBudgetAllocation:ReconciledSpendPrivacy": {
    id: "NhsTokenisedBudgetAllocation:ReconciledSpendPrivacy",
    label: "ReconciledSpendPrivacy",
    module: "NhsTokenisedBudgetAllocation",
    category: "privacy",
    defaultActAs: "Trust-GSTT",
    description: "Countersigned spend disclosed to the auditor, with amount commitment.",
    fields: [
      { name: "trust", kind: "party", required: true },
      { name: "commissioner", kind: "party", required: true },
      { name: "auditor", kind: "party", required: true },
      { name: "category", kind: "text", required: true, placeholder: "acute" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "42500.00" },
      {
        name: "amountCommit",
        kind: "hash",
        required: true,
        derivedFrom: "amountGbp",
        help: "Auto-derived from amountGbp.",
      },
      { name: "period", kind: "text", required: true, placeholder: "2026-04" },
      { name: "supplier", kind: "party", required: false, optional: true },
      {
        name: "supplierCommit",
        kind: "hash",
        required: false,
        optional: true,
        derivedFrom: "supplier",
      },
      { name: "settlementTxId", kind: "text", required: false, optional: true },
    ],
  },

  // ── Tokenisation ────────────────────────────────────────────
  "NhsTokenisedBudgetAllocation:TokenisationRequest": {
    id: "NhsTokenisedBudgetAllocation:TokenisationRequest",
    label: "NhsTokenisedBudgetAllocation:TokenisationRequest",
    module: "NhsTokenisedBudgetAllocation",
    category: "tokenisation",
    defaultActAs: "DHSC",
    description: "Allocator-signed request that can be minted into an NhsFundingToken.",
    fields: [
      { name: "allocator", kind: "party", required: true },
      { name: "recipient", kind: "party", required: true },
      { name: "fiscalYear", kind: "text", required: true, placeholder: "2026-27" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "1000000.00" },
      { name: "tokenId", kind: "text", required: true, placeholder: "NHS-FT-2026-001" },
    ],
  },
  "NhsTokenisedBudgetAllocation:NhsFundingToken": {
    id: "NhsTokenisedBudgetAllocation:NhsFundingToken",
    label: "NhsTokenisedBudgetAllocation:NhsFundingToken",
    module: "NhsTokenisedBudgetAllocation",
    category: "tokenisation",
    defaultActAs: "DHSC",
    description: "Fungible NHS funding token co-signed by issuer + owner.",
    fields: [
      { name: "issuer", kind: "party", required: true },
      { name: "owner", kind: "party", required: true },
      { name: "tokenId", kind: "text", required: true, placeholder: "NHS-FT-2026-001" },
      { name: "fiscalYear", kind: "text", required: true, placeholder: "2026-27" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "1000000.00" },
      {
        name: "amountCommit",
        kind: "hash",
        required: true,
        derivedFrom: "amountGbp",
        help: "Auto-derived from amountGbp.",
      },
    ],
  },
  "NhsTokenisedBudgetAllocation:TokenRedemption": {
    id: "NhsTokenisedBudgetAllocation:TokenRedemption",
    label: "NhsTokenisedBudgetAllocation:TokenRedemption",
    module: "NhsTokenisedBudgetAllocation",
    category: "tokenisation",
    defaultActAs: "Trust-GSTT",
    description: "Owner-initiated redemption of an NHS funding token back to the issuer.",
    fields: [
      { name: "owner", kind: "party", required: true },
      { name: "issuer", kind: "party", required: true },
      { name: "tokenId", kind: "text", required: true, placeholder: "NHS-FT-2026-001" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "1000000.00" },
    ],
  },

  // ── Proofs & private settlement ─────────────────────────────
  "NhsTokenisedBudgetAllocation:PrivateSettlement": {
    id: "NhsTokenisedBudgetAllocation:PrivateSettlement",
    label: "NhsTokenisedBudgetAllocation:PrivateSettlement",
    module: "NhsTokenisedBudgetAllocation",
    category: "proofs",
    defaultActAs: "Trust-GSTT",
    description: "Trust + commissioner settlement record with hashed amount + purpose.",
    fields: [
      { name: "trust", kind: "party", required: true },
      { name: "commissioner", kind: "party", required: true },
      { name: "auditor", kind: "party", required: true },
      { name: "tokenId", kind: "text", required: true, placeholder: "NHS-FT-2026-001" },
      { name: "amountCommit", kind: "hash", required: true, derivedFrom: "tokenId" },
      { name: "purposeCommit", kind: "hash", required: true, derivedFrom: "tokenId" },
      { name: "settlementRef", kind: "text", required: false, optional: true, placeholder: "tx-hash" },
    ],
  },
  "NhsTokenisedBudgetAllocation:ProofOfAmount": {
    id: "NhsTokenisedBudgetAllocation:ProofOfAmount",
    label: "NhsTokenisedBudgetAllocation:ProofOfAmount",
    module: "NhsTokenisedBudgetAllocation",
    category: "proofs",
    defaultActAs: "Auditor",
    description: "Zero-knowledge-style proof that an amount matches a commitment.",
    fields: [
      { name: "commitmentCid", kind: "text", required: true, placeholder: "cid-…" },
      { name: "preImage", kind: "text", required: true, placeholder: "42500.00" },
      { name: "hashValue", kind: "hash", required: true, derivedFrom: "preImage" },
      { name: "verifier", kind: "party", required: true },
    ],
  },
  "NhsTokenisedBudgetAllocation:ProofOfSupplier": {
    id: "NhsTokenisedBudgetAllocation:ProofOfSupplier",
    label: "NhsTokenisedBudgetAllocation:ProofOfSupplier",
    module: "NhsTokenisedBudgetAllocation",
    category: "proofs",
    defaultActAs: "Auditor",
    description: "Proof that a supplier identity matches a commitment.",
    fields: [
      { name: "commitmentCid", kind: "text", required: true, placeholder: "cid-…" },
      { name: "preImage", kind: "text", required: true, placeholder: "supplier-party-id" },
      { name: "hashValue", kind: "hash", required: true, derivedFrom: "preImage" },
      { name: "verifier", kind: "party", required: true },
    ],
  },

  // ── Parallel invoice workflow (unchanged) ───────────────────
  "Nhs:Invoice": {
    id: "Nhs:Invoice",
    label: "Invoice",
    module: "Nhs",
    category: "invoice",
    defaultActAs: "Trust-GSTT",
    description: "Trust-issued invoice awaiting ICB countersignature.",
    fields: [
      { name: "trust", kind: "party", required: true },
      { name: "commissioner", kind: "party", required: true },
      { name: "auditor", kind: "party", required: true },
      { name: "invoiceRef", kind: "text", required: true, placeholder: "INV-2026-04-001" },
      { name: "category", kind: "text", required: true, placeholder: "acute" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "42500.00" },
      { name: "period", kind: "text", required: true, placeholder: "2026-04" },
      { name: "supplier", kind: "party", required: false, optional: true },
    ],
  },
};

export const TEMPLATE_LIST: TemplateDef[] = Object.values(TEMPLATES);

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as [TemplateId, ...TemplateId[]];

export const TEMPLATES_BY_CATEGORY: Record<TemplateCategory, TemplateDef[]> = {
  privacy: TEMPLATE_LIST.filter((t) => t.category === "privacy"),
  tokenisation: TEMPLATE_LIST.filter((t) => t.category === "tokenisation"),
  proofs: TEMPLATE_LIST.filter((t) => t.category === "proofs"),
  invoice: TEMPLATE_LIST.filter((t) => t.category === "invoice"),
};

export function optionalFieldNames(id: TemplateId): Set<string> {
  return new Set(TEMPLATES[id].fields.filter((f) => f.optional).map((f) => f.name));
}

/**
 * Compute a commitment value for a `hash` field. Mirrors the Daml
 * `hashText` implementation in NhsTokenisedBudgetAllocation.daml, which is
 * currently the identity function — the on-ledger commitment is just the
 * pre-image text. Kept as a function so the impl can swap to a real digest
 * (e.g. SHA-256) without touching call sites.
 */
export function hashText(source: string): string {
  return source;
}
