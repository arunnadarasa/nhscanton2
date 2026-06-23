# Fix: Invoice template missing on Canton ledger

## Root cause

The live ledger has a stale `nhs-budget` 0.1.1 package (hash `0561570911…`) that pre-dates the `Invoice` template. Canton resolves `#nhs-budget:Nhs:Invoice` to that older package and returns `TEMPLATES_OR_INTERFACES_NOT_FOUND`. Re-uploading the current 0.1.1 fails with `KNOWN_PACKAGE_VERSION` (same name+version, different hash), and our recent idempotency change treats that as success — so the new DAR with `Invoice` never actually lands.

A package version on a Canton ledger is effectively immutable. The only clean fix is to publish under a new version number.

## Steps

1. **Bump version to 0.1.2**
  - `daml/daml.yaml`: `version: 0.1.1` → `version: 0.1.2`.
2. **Rebuild the DAR locally and check it in**
  - Run `dpm build` in `daml/`.
  - Copy the new artifact to `public/dars/nhs-budget-0.1.2.dar.bin`.
  - Delete `public/dars/nhs-budget-0.1.1.dar.bin`.
3. **Point the deployer at the new file**
  - `src/lib/canton/deploy-core.server.ts`: `DAR_ASSET_PATH = "/dars/nhs-budget-0.1.2.dar.bin"`.
4. **Tighten the idempotency guard so this can't recur silently**
  - Keep 409 (duplicate hash) as success.
  - Treat `KNOWN_PACKAGE_VERSION` as success **only** when the local DAR's main package hash matches a hash already vetted on the ledger. Otherwise surface a hard error: "ledger already has a different `nhs-budget` 0.1.2 — bump the version."
  - Computing the local hash needs the DAR's main package id. Simplest path: read it from `daml/.daml/dist/nhs-budget-0.1.2.conf` or a small `dar-meta.json` we write at build time. Acceptable fallback: compare the upload response's reported package id against the ledger's listing via `/v2/packages`.
5. **Re-run smoke**
  - `POST /api/public/admin/self-deploy` with `x-deploy-token` — expect a fresh upload, not "alreadyVetted".
  - `POST /api/public/admin/smoke-invoice` — expect both SpendCommitment and Invoice flows to return reconciled records.
  - Then retry "Issue invoice to commissioner" from the UI.

## Out of scope

- Cleaning up the stale 0.1.0 / 0.1.1 packages on the ledger (Canton doesn't expose unvet from our admin surface; harmless to leave since `#nhs-budget` will resolve to the highest version 0.1.2).
- USDCx settlement (still deferred).

## Question for you

Step 2 needs `dpm build` to run somewhere with the Daml 3.5 toolchain. I can't run it inside this sandbox. Two options:

- **(a)** You run `dpm build` locally and upload the resulting `nhs-budget-0.1.2.dar.bin`, and I wire everything else up.
- **(b)** I do everything except the rebuild, then hand you a one-line command and the exact path to drop the artifact at.

Which do you prefer? Attempt to run it on your sandbox, you can do it