# Add Invoice flow

The diagram shows a parallel `Invoice` child off `Trust::GSTT` that lands at `ICB::LDN`, then `Countersign` → `ReconciledSpend` (Trust + ICB signed, Auditor observer). Today the app only models `SpendCommitment`. This adds `Invoice` as a peer concept end-to-end, and exposes the relevant `NhsTokenisedBudgetAllocation` parameters as inputs.

## What gets built

### 1. Daml — `daml/Nhs.daml`
Add a new template (kept additive so existing flows still compile):

```text
template Invoice
  with
    trust        : Party    -- issuer
    commissioner : Party    -- ICB (observer)
    auditor      : Party
    invoiceRef   : Text     -- e.g. INV-2026-04-001
    category     : Text
    amountGbp    : Decimal
    period       : Text
    supplier     : Optional Party
  where
    signatory trust
    observer  commissioner
    observer  (optional [] (\p -> [p]) supplier)

    choice CountersignInvoice : ContractId ReconciledSpend
      controller commissioner
      do create ReconciledSpend with
           trust, commissioner, auditor, category, amountGbp, period,
           supplier, settlementTxId = None
```

Mirror the same template in `daml/NhsTokenisedBudgetAllocation.daml` for parity with the tokenised module.

### 2. Ledger client — `src/lib/canton/`
- `types.ts`: add `Invoice` payload type.
- `client.server.ts`: add `createInvoice`, `queryInvoices`, `countersignInvoice` (live + memory paths, same shape as the SpendCommitment helpers).
- `allContractsForExplorer`: include `Nhs:Invoice` in the per-party query fan-out so it appears on `/ledger` and `/audit`.

### 3. Server functions — `src/lib/nhs/canton.functions.ts`
Add:
- `getInvoicesForParty({ party })`
- `submitInvoice({ trustCode, icbCode, invoiceRef, category, amountGbp, period, supplier? })`
- `countersignInvoice({ contractId, icbCode })`

### 4. Generic Create-Contract UI — `src/lib/canton/templates.ts`
Register `Nhs:Invoice` with fields: `trust`, `commissioner`, `auditor`, `invoiceRef`, `category`, `amountGbp`, `period`, optional `supplier`. This makes it submittable from `/contracts/new` with no extra UI work; `contracts.functions.ts` Zod schema is data-driven from `TEMPLATES`.

### 5. Page wiring
- `src/routes/trust.$trustId.tsx`: add an "Issue invoice" form and an "Invoices" list (mirrors the existing SpendCommitment block; uses `submitInvoice` + `getInvoicesForParty`).
- `src/routes/icb.$icbCode.tsx`: add an "Inbound invoices" list with a `Countersign` action that calls `countersignInvoice` and invalidates the reconciled-spend query.
- `/ledger` and `/audit` automatically pick up the new template via `allContractsForExplorer`.

### 6. DAR redeploy
After Daml changes, the user runs `POST /api/public/admin/deploy` with `x-deploy-token` to upload the rebuilt DAR. No infra/secret changes required.

## Out of scope (call out)
- No new tables, no auth changes, no edge functions.
- Tokenised privacy templates (`SpendCommitmentPrivacy`, `ProofOf*`, etc.) stay Daml-only for now — happy to wire them next once the Invoice flow is in.
