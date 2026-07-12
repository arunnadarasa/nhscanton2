# Generic Create-Contract UI (template registry pattern)

One dynamic form at `/contracts/new` that can create **every** template your DAR exposes. Adding a new template is a data change (a new entry in a registry), not a new React route.

## Why this pattern

Bespoke create-forms per template metastasize fast. By slide 3 of a Daml app you have 8 templates; by production you have 27. Each hand-rolled form drifts from the actual template signature (a field renamed in Daml but not the form), each has its own validation, and each has to be updated when you switch from memory mode to Devnet. A registry-driven form fixes all three: the registry IS the schema.

## Shape of the registry

```ts
// src/lib/canton/templates.ts
import { sha256Hex } from "./commitments";

export type TemplateFieldKind =
  | "text"
  | "number"
  | "party"        // resolved via the bootstrap party map
  | "amount"       // number rendered as GBP/USDC
  | "date"
  | "hash";        // computed from another field via SHA-256

export type TemplateField = {
  key: string;                    // Daml field name — MUST match exactly
  label: string;                  // UI label
  kind: TemplateFieldKind;
  required?: boolean;
  hashedFrom?: string;            // for kind:"hash", the field key whose value we SHA-256
  help?: string;
};

export type TemplateDef = {
  id: string;                     // stable ui id, e.g. "budget-allocation"
  group:                          // used for section grouping in the UI
    | "Budget Allocation"
    | "Spend Commitment"
    | "Reconciled Spend"
    | "Settlement"
    | "Invoice";
  label: string;
  packageName: string;            // e.g. "nhs-budget-app"
  moduleName: string;             // e.g. "Nhs.BudgetAllocation"
  entityName: string;             // e.g. "BudgetAllocation"
  fields: TemplateField[];
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: "budget-allocation",
    group: "Budget Allocation",
    label: "NHSE → ICB allocation",
    packageName: "nhs-budget-app",
    moduleName: "Nhs.BudgetAllocation",
    entityName: "BudgetAllocation",
    fields: [
      { key: "nhse", label: "NHSE party", kind: "party", required: true },
      { key: "icb", label: "ICB party", kind: "party", required: true },
      { key: "amount", label: "Amount (GBP)", kind: "amount", required: true },
      { key: "purpose", label: "Purpose", kind: "text", required: true },
      {
        key: "purposeHash",
        label: "Purpose commitment",
        kind: "hash",
        hashedFrom: "purpose",
        help: "Auto-derived SHA-256 of purpose; matches Daml hashText.",
      },
    ],
  },
  // …one entry per template. Yes, 27 entries. Yes, that's the point.
];
```

## The dynamic form

```tsx
// src/routes/contracts.new.tsx (excerpt)
function CreateContractForm({ template }: { template: TemplateDef }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const create = useServerFn(createCommand);

  // Recompute every `hash` field whenever its source changes.
  useEffect(() => {
    (async () => {
      const next = { ...values };
      let changed = false;
      for (const f of template.fields) {
        if (f.kind !== "hash" || !f.hashedFrom) continue;
        const src = values[f.hashedFrom] ?? "";
        const hash = await sha256Hex(src);
        if (next[f.key] !== hash) { next[f.key] = hash; changed = true; }
      }
      if (changed) setValues(next);
    })();
  }, [values, template]);

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      create({ data: { templateId: template.id, values } });
    }}>
      {template.fields.map((f) => <FieldInput key={f.key} field={f} value={values[f.key] ?? ""} onChange={(v) => setValues({ ...values, [f.key]: v })} />)}
      <button type="submit">Create</button>
    </form>
  );
}
```

## The single server function

```ts
// src/lib/canton/create.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TEMPLATES } from "./templates";

export const createCommand = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      templateId: z.string(),
      values: z.record(z.string(), z.string()),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const t = TEMPLATES.find((x) => x.id === data.templateId);
    if (!t) throw new Error(`Unknown templateId: ${data.templateId}`);
    // 1. resolve any `party` fields via the bootstrap logical→party map
    // 2. coerce amounts / dates
    // 3. build the JSON Ledger v2 `CreateCommand`:
    //    { templateId: `#${t.packageName}:${t.moduleName}:${t.entityName}`,
    //      createArguments: mappedValues }
    // 4. POST /v2/commands/submit-and-wait-for-transaction
    // 5. record to the execution log (see references/mode-runtime.md)
  });
```

## Grouping

Group templates by **domain** in the UI (Budget Allocation, Spend Commitment, Reconciled Spend, Settlement, Invoice) — the labels a non-engineer would use. Grouping by tech concern (Privacy Flow, Tokenisation, Proofs & Settlement) makes the picker read like an implementation diary and hides the business flow that made the app worth building. The first grouping you demo to a customer is the one that sticks.

## Rules

- **The registry IS the schema.** Field `key`s must match Daml field names exactly. When you rename a Daml field, rename the registry entry in the same commit.
- **One route, not N.** Do not add `/contracts/new-budget-allocation` alongside `/contracts/new`. The form is dynamic on purpose.
- **`hash` fields are read-only in the UI.** Render them derived, disabled, with the pre-image field feeding them highlighted.
- **Never duplicate `hashText` logic in the form.** Import from the shared `commitments.ts` helper (see `references/commitment-hashing.md`).
