// Hand-maintained registry of Daml templates exposed in the generic
// "Create Contract" UI. Mirrors daml/Nhs.daml.
//
// `kind` drives the form input type and the Zod validation built in
// `contracts.functions.ts`.

export type FieldKind = "party" | "text" | "numeric";

export interface TemplateField {
  name: string;
  kind: FieldKind;
  required: boolean;
  /** True if the underlying Daml field is wrapped in `Optional`. Drives JSON encoding. */
  optional?: boolean;
  placeholder?: string;
  help?: string;
}

export interface TemplateDef {
  id: TemplateId;
  label: string;
  module: string; // e.g. "Nhs"
  fields: readonly TemplateField[];
  /** Logical-name hint of the party that should submit (actAs) by default. */
  defaultActAs?: string;
}

export type TemplateId =
  | "Nhs:BudgetAllocation"
  | "Nhs:SpendCommitment"
  | "Nhs:ReconciledSpend"
  | "Nhs:Invoice";

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  "Nhs:BudgetAllocation": {
    id: "Nhs:BudgetAllocation",
    label: "BudgetAllocation",
    module: "Nhs",
    defaultActAs: "DHSC",
    fields: [
      { name: "allocator", kind: "party", required: true },
      { name: "recipient", kind: "party", required: true },
      { name: "fiscalYear", kind: "text", required: true, placeholder: "2026-27" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "1000000.00" },
      { name: "purpose", kind: "text", required: true, placeholder: "ICB block contract" },
    ],
  },
  "Nhs:SpendCommitment": {
    id: "Nhs:SpendCommitment",
    label: "SpendCommitment",
    module: "Nhs",
    defaultActAs: "Trust-GSTT",
    fields: [
      { name: "trust", kind: "party", required: true },
      { name: "commissioner", kind: "party", required: true },
      { name: "auditor", kind: "party", required: true },
      { name: "category", kind: "text", required: true, placeholder: "acute" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "42500.00" },
      { name: "period", kind: "text", required: true, placeholder: "2026-04" },
      { name: "supplier", kind: "party", required: false, optional: true },
      { name: "paymentAmount", kind: "numeric", required: false, optional: true },
    ],
  },
  "Nhs:ReconciledSpend": {
    id: "Nhs:ReconciledSpend",
    label: "ReconciledSpend",
    module: "Nhs",
    defaultActAs: "Trust-GSTT",
    fields: [
      { name: "trust", kind: "party", required: true },
      { name: "commissioner", kind: "party", required: true },
      { name: "auditor", kind: "party", required: true },
      { name: "category", kind: "text", required: true, placeholder: "acute" },
      { name: "amountGbp", kind: "numeric", required: true, placeholder: "42500.00" },
      { name: "period", kind: "text", required: true, placeholder: "2026-04" },
      { name: "supplier", kind: "party", required: false, optional: true },
      { name: "settlementTxId", kind: "text", required: false, optional: true },
    ],
  },
  "Nhs:Invoice": {
    id: "Nhs:Invoice",
    label: "Invoice",
    module: "Nhs",
    defaultActAs: "Trust-GSTT",
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

export function optionalFieldNames(id: TemplateId): Set<string> {
  return new Set(TEMPLATES[id].fields.filter((f) => f.optional).map((f) => f.name));
}
