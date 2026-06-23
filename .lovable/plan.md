# Invoice supplier field — DONE

Shipped: `supplier : Optional Party` → `supplierName : Optional Text` on `SpendCommitment`, `ReconciledSpend`, `Invoice`. Package renamed `nhs-budget-app` → `nhs-budget-app-v2` (1.0.1) to sidestep the upgrade-compat check. New DAR at `public/dars/nhs-budget-app-v2-1.0.1.dar.bin`, deployed to Seaport Devnet, end-to-end smoke green (deploy + SpendCommitment + Invoice). UI shows "Supplier name (optional)" as plain text.

Future USDCx work: add a separate `supplierParty : Optional Party` field alongside `supplierName` (see `docs/canton-deploy/06-usdcx.md`).
