## What we know

- The UI error on step 2 (NHSEngland → ICB) is Canton's "security-sensitive 403", which means the runtime OIDC token's `sub` doesn't match a ledger user that holds `CanActAs` for NHSEngland.
- The code path is already correct:
  - `getRuntimeLedgerUserId()` derives the ledger user id from the runtime JWT's `sub` (or `applicationId`).
  - `runDeploy()` uses that id for `POST /v2/users` and grants `CanActAs` + `CanReadAs` for every party (DHSC, NHSEngland, Auditor, all ICBs, all Trusts).
  - Bootstrap and runtime tokens share the same client on this project (no separate `BOOTSTRAP_CLIENT_ID`), so `sub` is consistent between admin ops and command submission.
- Step 1 (DHSC) succeeded, which proves the token can act — so the mismatch is party-specific, not global. Either the last Deploy predates the fix, or NHSEngland's grant was skipped/rolled back for some reason.

I can't run Deploy from plan mode (need `DEPLOY_ADMIN_TOKEN`, which is encrypted; the tool call returns 401 without it).

## Plan

1. **You click Deploy** at `/deploy` → "Initialize live ledger". This re-mints the runtime token, re-creates the user under its `sub`, and re-grants `CanActAs`/`CanReadAs` on every party (idempotent — safe to run repeatedly).
2. When it finishes, paste (or screenshot) the JSON response. I specifically want:
   - `allocs` — every hint should have a `partyId`, none should have `error`.
   - `rightsResult` — status should be 200/OK.
   - `rightsVerify` — `missingActAs` and `missingReadAs` must both be empty; `listed` should equal 2× the party count.
3. Then retry step 2 (NHSEngland → ICB::NEY).

## If step 2 still 403s after a clean Deploy

I'll switch to build mode and:
- Add server-side logging inside `submitAndWait` to record `{ userId, actAs, resolvedActAs }` and dump the response body verbatim on 403 (currently we only surface Canton's opaque `cause`).
- Add a `/api/public/admin/whoami` diagnostic route that returns `{ runtimeUserId, tokenSub, rights: [...] }` from the participant so we can confirm the live rights table matches what `runDeploy` claims to have granted.
- Cross-check that `partyNhsE()` resolves to the same `NHSEngland::<fingerprint>` that appears in the rights list (in case an older allocation with a different fingerprint is being reused from `canton_parties`).

No code changes proposed yet — Deploy first, then decide.
