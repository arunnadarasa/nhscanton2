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

export type TemplateCategory =
  | "budget-allocation"
  | "spend-commitment"
  | "reconciled-spend"
  | "settlement"
  | "invoice";

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
  | "Nhs:Invoice"
  // Reviews & analytics (nonconsuming choices over existing contracts)
  | "BudgetAllocationReview:BudgetAllocationReview"
  | "CommitmentInspector:CommitmentInspector"
  | "InvoiceAnalytics:InvoiceAnalytics"
  | "InvoiceRisk:InvoiceRisk"
  | "SettlementReview:SettlementReview";

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  // ── Privacy flow ─────────────────────────────────────────────
  "NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy": {
    id: "NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy",
    label: "NHS:BudgetAllocationPrivacy",
    module: "NhsTokenisedBudgetAllocation",
    category: "budget-allocation",
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
        help: "Auto-derived from purpose (SHA-256, matches Daml hashText).",
      },
    ],
  },
  "NhsTokenisedBudgetAllocation:SpendCommitmentPrivacy": {
    id: "NhsTokenisedBudgetAllocation:SpendCommitmentPrivacy",
    label: "NHS:SpendCommitmentPrivacy",
    module: "NhsTokenisedBudgetAllocation",
    category: "spend-commitment",
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
    label: "NHS:ReconciledSpendPrivacy",
    module: "NhsTokenisedBudgetAllocation",
    category: "reconciled-spend",
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
    label: "NHS:BudgetAllocation:TokenisationRequest",
    module: "NhsTokenisedBudgetAllocation",
    category: "budget-allocation",
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
    label: "NHS:BudgetAllocation:NhsFundingToken",
    module: "NhsTokenisedBudgetAllocation",
    category: "budget-allocation",
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
    label: "NHS:BudgetAllocation:TokenRedemption",
    module: "NhsTokenisedBudgetAllocation",
    category: "budget-allocation",
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
    label: "NHS:Settlement:PrivateSettlement",
    module: "NhsTokenisedBudgetAllocation",
    category: "settlement",
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
    label: "NHS:Settlement:ProofOfAmount",
    module: "NhsTokenisedBudgetAllocation",
    category: "settlement",
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
    label: "NHS:Settlement:ProofOfSupplier",
    module: "NhsTokenisedBudgetAllocation",
    category: "settlement",
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

  // ── Reviews & analytics ─────────────────────────────────────
  "BudgetAllocationReview:BudgetAllocationReview": {
    id: "BudgetAllocationReview:BudgetAllocationReview",
    label: "BudgetAllocationReview:BudgetAllocationReview",
    module: "BudgetAllocationReview",
    category: "budget-allocation",
    defaultActAs: "Auditor",
    description: "Reviewer inspects a BudgetAllocation contract for validity.",
    fields: [
      { name: "allocationCid", kind: "text", required: true, placeholder: "cid-…", help: "ContractId of the BudgetAllocation to review." },
      { name: "reviewer", kind: "party", required: true },
    ],
  },
  "CommitmentInspector:CommitmentInspector": {
    id: "CommitmentInspector:CommitmentInspector",
    label: "CommitmentInspector:CommitmentInspector",
    module: "CommitmentInspector",
    category: "spend-commitment",
    defaultActAs: "Auditor",
    description: "Auditor verifies the integrity of a SpendCommitmentPrivacy commitment.",
    fields: [
      { name: "commitmentCid", kind: "text", required: true, placeholder: "cid-…", help: "ContractId of the SpendCommitmentPrivacy." },
      { name: "auditor", kind: "party", required: true },
    ],
  },
  "InvoiceAnalytics:InvoiceAnalytics": {
    id: "InvoiceAnalytics:InvoiceAnalytics",
    label: "InvoiceAnalytics:InvoiceAnalytics",
    module: "InvoiceAnalytics",
    category: "invoice",
    defaultActAs: "Auditor",
    description: "Analyst computes VAT and invoice total from an Invoice contract.",
    fields: [
      { name: "invoiceCid", kind: "text", required: true, placeholder: "cid-…", help: "ContractId of the Invoice." },
      { name: "analyst", kind: "party", required: true },
    ],
  },
  "InvoiceRisk:InvoiceRisk": {
    id: "InvoiceRisk:InvoiceRisk",
    label: "InvoiceRisk:InvoiceRisk",
    module: "InvoiceRisk",
    category: "invoice",
    defaultActAs: "Auditor",
    description: "Auditor classifies an Invoice as low / medium / high risk.",
    fields: [
      { name: "invoiceCid", kind: "text", required: true, placeholder: "cid-…", help: "ContractId of the Invoice." },
      { name: "auditor", kind: "party", required: true },
    ],
  },
  "SettlementReview:SettlementReview": {
    id: "SettlementReview:SettlementReview",
    label: "SettlementReview:SettlementReview",
    module: "SettlementReview",
    category: "settlement",
    defaultActAs: "Auditor",
    description: "Reviewer checks a PrivateSettlement is ready for audit.",
    fields: [
      { name: "settlementCid", kind: "text", required: true, placeholder: "cid-…", help: "ContractId of the PrivateSettlement." },
      { name: "reviewer", kind: "party", required: true },
    ],
  },
};

export const TEMPLATE_LIST: TemplateDef[] = Object.values(TEMPLATES);

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as [TemplateId, ...TemplateId[]];

export const TEMPLATES_BY_CATEGORY: Record<TemplateCategory, TemplateDef[]> = {
  "budget-allocation": TEMPLATE_LIST.filter((t) => t.category === "budget-allocation"),
  "spend-commitment": TEMPLATE_LIST.filter((t) => t.category === "spend-commitment"),
  "reconciled-spend": TEMPLATE_LIST.filter((t) => t.category === "reconciled-spend"),
  settlement: TEMPLATE_LIST.filter((t) => t.category === "settlement"),
  invoice: TEMPLATE_LIST.filter((t) => t.category === "invoice"),
};

export function optionalFieldNames(id: TemplateId): Set<string> {
  return new Set(TEMPLATES[id].fields.filter((f) => f.optional).map((f) => f.name));
}

/**
 * Compute a commitment value for a `hash` field. Mirrors the Daml
 * `hashText` implementation in NhsTokenisedBudgetAllocation.daml, which
 * uses `DA.Text.sha256` — a lowercase hex-encoded SHA-256 of the UTF-8
 * bytes of the pre-image. This lets the UI produce the exact same
 * commitment string the ledger will compute.
 */
export function hashText(source: string): string {
  // Synchronous SHA-256 over UTF-8 bytes → lowercase hex, matching Daml `sha256`.
  const bytes = new TextEncoder().encode(source);
  return sha256Hex(bytes);
}

// --- Minimal synchronous SHA-256 (FIPS 180-4) --------------------------------
// Kept inline so the helper stays sync + usable on both server and client
// without pulling in a crypto dependency. Not hot-path.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Hex(input: Uint8Array): string {
  const l = input.length;
  const withOne = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  withOne.set(input);
  withOne[l] = 0x80;
  const bitLen = l * 8;
  // 64-bit big-endian length in the last 8 bytes
  const view = new DataView(withOne.buffer);
  view.setUint32(withOne.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(withOne.length - 4, bitLen >>> 0);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  for (let off = 0; off < withOne.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) out += H[i].toString(16).padStart(8, "0");
  return out;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

