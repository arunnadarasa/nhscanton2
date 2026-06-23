# Sync README.md to the current Daml model

The GitHub README is stale in four concrete ways. Everything that needs to change is in `README.md`; no app code is touched.

## What's stale

1. **Package name / DAR path** — README still says `nhs-budget-0.1.0.dar`. The shipped artifact is `nhs-budget-app-v2-1.0.1.dar` (package renamed to dodge `KNOWN_PACKAGE_VERSION` after the supplier-field schema change).
2. **Template count** — README documents 3 templates. The model now has 4: `BudgetAllocation`, `SpendCommitment`, `ReconciledSpend`, **`Invoice`** (with `CountersignInvoice` choice that produces a `ReconciledSpend`). Invoice is the supplier-facing parallel to SpendCommitment.
3. **Supplier field type** — README shows `supplier : Optional Party` on `SpendCommitment` and `ReconciledSpend`. The model now has `supplierName : Optional Text`. The "Optional Supplier" entry in the Visibility lists is wrong (a text field can't be an observer).
4. **USDCx settlement leg** — README implies `supplier` is a `Party` that receives USDCx today. Updated copy: `supplierName` is the human label (audit trail); when USDCx settlement is wired in, a separate `supplierParty : Party` is passed as a choice argument so the on-chain payee stays distinct from the text label.

## Edits in `README.md`

- **Line 27-32 (Supplier Settlement paragraph)** — rewrite so it talks about `supplierName : Optional Text` as the human label, and a *separate, future* `supplierParty : Party` choice argument as the on-chain payee for USDCx. Drop the implication that today's `supplier` field is a party.
- **Line 73 + 91 (DAR filenames)** — `nhs-budget-0.1.0.dar` → `nhs-budget-app-v2-1.0.1.dar`. Mention the `nhs-budget-app` → `nhs-budget-app-v2` rename briefly so anyone reading the repo isn't confused by the `-v2` suffix.
- **Smart Contract Architecture section (lines 148-244)**:
  - SpendCommitment: rename `supplier | Optional Party` → `supplierName | Optional Text`, remove "Optional Supplier" from Visibility.
  - ReconciledSpend: same rename + same Visibility fix.
  - Add a new **Invoice** subsection after ReconciledSpend documenting fields (`trust`, `commissioner`, `auditor`, `invoiceRef`, `category`, `amountGbp`, `period`, `supplierName : Optional Text`), visibility (Trust signatory, Commissioner observer), and the `CountersignInvoice` choice (produces a `ReconciledSpend`, preserves `supplierName`).
  - Update "What Our App Does" bullet list to mention the supplier-invoice parallel flow.
- **Add a short "Lessons learned" section** near the bottom (before Sources) with three bullets mirroring what's in the in-app deck and `LEARNINGS.md`: free text = `Optional Text` not `Optional Party`; two JWT subjects; rename the package (not the version) for non-compat schema changes.

## Out of scope

- Daml model, server functions, UI — already current.
- `/hackathon`, `/how-it-works`, `/deck` in-app pages — updated in earlier turns.
- `docs/canton-deploy/LEARNINGS.md`, `06-usdcx.md` — updated in earlier turns.
- No publish; this is README-only and propagates to GitHub through the existing two-way sync.
