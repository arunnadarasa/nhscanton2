## Where we are

- Live ledger smoke test is green: `SpendCommitment → Countersign → ReconciledSpend` round-trips on Seaport devnet with the correct parties.
- `Invoice` template is now in the deployed DAR (v0.1.1) and stays — both `SpendCommitment` and `Invoice` workflows are first-class.
- `countersign` / `countersignInvoice` now correctly act as the commissioner.
- One known wart: `self-deploy` returns 400 (`KNOWN_PACKAGE_VERSION`) on repeat runs because a previous v0.1.1 with a different hash is already vetted.

## Proposed next steps (in order)

### 1. Make `self-deploy` idempotent
Treat `KNOWN_PACKAGE_VERSION` as success in `deploy-core.server.ts`, alongside the existing 409 dedupe. The package is already on-ledger, so this is a no-op, not a failure. Result: green `self-deploy` on every call.

### 2. Live-mode smoke for the Invoice path
Add `/api/public/admin/smoke-invoice-live` (or a query flag on the existing route) that exercises `createInvoice → CountersignInvoice → ReconciledSpend` end-to-end on the live ledger, mirroring the SpendCommitment smoke. Confirms the new Invoice template actually works on-chain.

### 3. Audit other `liveExercise` call sites for the same actAs bug
`liveExercise` silently defaults to `NHSEngland`. The countersign fix patched two call sites — sweep `client.server.ts` and `live.server.ts` for any other exercise that doesn't pass an explicit `actAs`, and either pass the right party or make `actAs` a required parameter so the bug can't recur.

### 4. Lock down the temp admin endpoints
`/api/public/admin/self-deploy`, `/self-diagnose`, `/deploy-trace`, `/smoke-invoice` are unauthenticated on the published site. Add a shared-secret check (header `x-admin-token` compared against `process.env.ADMIN_DEPLOY_TOKEN`, timing-safe). Without this, anyone can trigger a DAR upload or ledger writes.

### 5. (Deferred) USDCx settlement
`settleWithUsdcx` is still `"simulated"`. Real settlement needs the USDCx DAR as a data-dependency, the commented `SettleAndCountersign` choice enabled in `Nhs.daml`, a rebuild, and `CANTON_USDCX_PACKAGE_ID` set. Larger scope — flagging for later, not in this batch.

## What this plan delivers

After steps 1–4: a clean, repeatable deploy + smoke loop covering both `SpendCommitment` and `Invoice` paths on the live ledger, with no remaining silent-default bugs and the admin endpoints no longer open to the public internet.

## Technical notes

- Step 1: one extra status check in `deploy-core.server.ts` next to the existing 409 branch — match on response body containing `KNOWN_PACKAGE_VERSION`.
- Step 2: new route `src/routes/api/public/admin.smoke-invoice-live.ts` modeled on the existing smoke test, calling `createInvoice` then `countersignInvoice`.
- Step 3: tighten the signature of `liveExercise` to require `actAs: Party` and remove the `?? "NHSEngland"` fallback so TypeScript surfaces any remaining call site.
- Step 4: add a `requireAdminToken(request)` helper used by all four admin routes; secret added via `add_secret` (`ADMIN_DEPLOY_TOKEN`).
