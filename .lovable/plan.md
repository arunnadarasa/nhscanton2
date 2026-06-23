## Goal

Capture what we learned this turn (devnet self-deploy + mock-USDCx mint, Auditor actAs grant) in the four "story" surfaces, matching the prior style of each.

## What's new to document

1. **`CanActAs` must include the Auditor.** The runtime ledger user was previously granted `CanReadAs` for every party but only `CanActAs` for non-Auditor parties. Mock-USDCx mint submits as the issuer (Auditor) — Canton returned `403 "A security-sensitive error has been received"`. Fix: grant `CanActAs` to Auditor too in `deploy-core.server.ts`, then re-run `self-deploy`.
2. **`#mock-usdcx` package-name reference works on JSON Ledger v2** — no need to pin the package hash; the participant resolves `#<name>:Module:Template` to the latest uploaded DAR.
3. **End-to-end devnet bring-up works via cookie override** — `Cookie: canton_network=seaport` on the two admin endpoints switches a single request to devnet without flipping `CANTON_MODE` globally.
4. **Live USDCx state on devnet** — 7 Trusts now hold 200,000,000.00 mock-USDCx each, issued by Auditor, on the Five North devnet validator.

## Files to update

### 1. `docs/canton-deploy/LEARNINGS.md`
Add a new dated entry covering:
- The 403 symptom + root cause (missing `CanActAs` for Auditor).
- Why the Auditor exception originally existed (Auditor is normally a read-only observer) and why it has to be lifted for mock-USDCx (Auditor is the issuer/signatory on `MockUsdcx:Holding`).
- The `#mock-usdcx` package-name resolution note.
- The cookie-based per-request network override pattern.

### 2. `src/routes/how-it-works.tsx` — `MegaPromptSection`
Append a bullet (matching the existing voice) noting that the runtime user must hold `CanActAs` rights on every signatory party it submits for — including issuer-only parties like Auditor — or `submit-and-wait` fails with an opaque 403.

### 3. `src/routes/deck.tsx`
Update whichever slide tracks "live state" / "what's on ledger" to reflect: mock-USDCx live on devnet, 7 Trusts funded at 200M USDCx each, issuer = Auditor. If there's a "lessons learned" or "what we shipped" slide, add a one-liner about the Auditor-actAs fix.

### 4. `README.md`
Under the deployment / status section, add a short note that devnet is live with mock-USDCx minted to all Trusts, and that the self-deploy route now grants `CanActAs` to all allocated parties (Auditor included).

## Out of scope

- No DAML or contract changes.
- No new admin endpoints.
- No changes to `CANTON_MODE` default — devnet stays opt-in via cookie.
- No re-mint (already done; balances are live).

## Verification

- `tsgo` typecheck after edits.
- Visual check that `/how-it-works` and `/deck` render the new copy without layout regressions.
