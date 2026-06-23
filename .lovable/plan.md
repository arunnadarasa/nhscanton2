# Invoice supplier field — recommendation

## Context

The current Daml model has `Invoice.supplier : Optional Party`. The UI exposes a free-text "Supplier party (optional)" input. Anything typed there is sent to Canton as a Party identifier and rejected with `UNKNOWN_INFORMEES` unless it's a pre-allocated party. For an NHS-style demo, suppliers (e.g. "AstraZeneca", "Encode Hackathon", "Lovable Smoke Co") are exactly the kind of value users would type freely — they aren't ledger participants.

## Recommendation: option (a) — make supplier a free-text label

Change the Daml model from `supplier : Optional Party` to `supplierName : Optional Text` on both `Invoice` and `ReconciledSpend` (and on `SpendCommitment` for symmetry, since it has the same field with the same problem). The party field was only useful as a precursor to USDCx settlement, where the supplier would need to be a real on-chain holder to receive payment. That path is still deferred (commented-out `SettleAndCountersign`). Until USDCx is wired in, "supplier" carries audit-trail value, not settlement value — text is the right type.

When we eventually enable USDCx, add a *separate* optional `supplierParty : Optional Party` alongside `supplierName`. The text label stays as the human-readable record; the party is added only when a real on-chain settlement is being prepared. That separation is also closer to how real procurement systems work (PO carries a supplier name; payment instruction adds the bank/wallet identity).

## Steps when this plan is approved

1. **Daml** (`daml/Nhs.daml`): rename `supplier : Optional Party` → `supplierName : Optional Text` on `SpendCommitment`, `ReconciledSpend`, `Invoice`. Remove the `observer (optional [] (\p -> [p]) supplier)` line on each (no party-based observer for a text field). Adjust `CountersignInvoice` / `Countersign` to pass `supplierName = supplierName` through.
2. **Bump version** in `daml.yaml` to `1.0.1`, rebuild with `damlc build` in the sandbox.
3. **Replace** `public/dars/nhs-budget-app-1.0.0.dar.bin` with the new `nhs-budget-app-1.0.1.dar.bin`; update `DAR_ASSET_PATH` in `deploy-core.server.ts`.
  - Same package name (`nhs-budget-app`) so Canton runs the upgrade check; renaming a field is not a backward-compatible upgrade (it's a remove + add), so this *will* fail the upgrade check. Workaround: bump the package name to `nhs-budget-app-v2` so it's treated as a fresh package, exactly like we did this turn. Update `v2TemplateId()` in `live.server.ts` accordingly.
4. **Types** (`src/lib/canton/types.ts`): `supplier?: Party | null` → `supplierName?: string | null` on `SpendCommitment`, `ReconciledSpend`, `Invoice`.
5. **UI** (the Invoice form in the index page): change label to "Supplier name (optional)", keep as plain text, no validation. Same for any place that surfaces `supplier` on `SpendCommitment` / `ReconciledSpend` rows — render `supplierName` instead.
6. **Re-publish, re-run the one-shot smoke**, then test the form by hand with "Encode Hackathon" as supplier name. Expect success.
7. **Delete the temp one-shot route** once green.

## Question for you before I start

Approve option (a) as scoped above? Or prefer option (b) — keep `supplier` as a Party in Daml and change the UI to a dropdown of pre-allocated parties (smaller code change, but suppliers are then limited to the bootstrap party list and won't reflect real procurement)? Free text is fine