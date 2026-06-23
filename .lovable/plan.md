# Roll the supplier-field lesson into the deck and the mega prompt

Last turn I updated `docs/canton-deploy/LEARNINGS.md` (new lesson #9 + "Schema migrations on a live Devnet ledger" section) and `docs/canton-deploy/06-usdcx.md`. The two user-facing surfaces that also need this knowledge are the **slide deck** (`/deck`) and the **mega prompt** (`/how-it-works`). The hackathon page (`/hackathon`) doesn't need changes — it doesn't enumerate Daml fields.

## 1. `src/routes/deck.tsx` — add a "Lessons learned" slide

The deck has 11 slides today (title → problem → solution → how → demo → why-canton → market → revenue → competitors → roadmap → criteria). Insert a new slide between **roadmap** and **criteria**, id `"lessons"`, kicker "What we learned", titled "Three things we'd tell the next builder."

Body: three short cards.

- **Free text is `Optional Text`, never `Optional Party`.** A `Party` is a real ledger participant — typing "AstraZeneca" into a supplier box throws `UNKNOWN_INFORMEES` at submit time. If a field needs a human label AND a future on-chain payee, model them as two fields.
- **Two JWT subjects, two purposes.** `participant_admin` only authorizes node ops (DAR upload, party allocation, user/rights mgmt). Ledger reads and command submission need a separate runtime user whose `sub` is the user id. On Devnet the validator *enforces* that the command `userId` matches the token's `sub` — derive it, don't hardcode it.
- **Schema migrations: rename the package, not the version.** Renaming a field on an installed Daml template isn't a backward-compatible upgrade. Re-uploading at a bumped patch fails with `KNOWN_PACKAGE_VERSION`. For a hackathon: bump the *package name* (`nhs-budget-app` → `nhs-budget-app-v2`), redeploy. Canton treats it as a fresh package.

Uses the existing `Slide` + `Bullet` primitives so it inherits the deck's styling. No new imports needed.

## 2. `src/routes/how-it-works.tsx` — harden the `MEGA_PROMPT` constant

Two targeted insertions into the existing template literal, so anyone who copies the prompt into a fresh Lovable project avoids the trap we just fell into.

**a. Under the "## Command submission" section,** add a new **"## Daml field types"** section:

> Anything the user types into a free-text field MUST be modelled as `Optional Text`, never `Optional Party`. A `Party` is a real ledger participant; submitting an unknown party returns `UNKNOWN_INFORMEES`. If a field needs both a human label and an on-chain identity (e.g. a supplier that might later be paid in USDCx), model them as two fields: `supplierName : Optional Text` + `supplierParty : Optional Party`. The text label is the audit-trail record; the party is added only when an on-chain settlement is being prepared.

**b. Under "## Bootstrap route",** add a new **"## Schema migrations on a live ledger"** section:

> If you rename or retype a field on an installed template, re-uploading the DAR at a bumped patch (`1.0.0` → `1.0.1`) under the same package name fails with `KNOWN_PACKAGE_VERSION` — Canton's upgrade check treats a field rename as a remove + add, which isn't backward-compatible. Workaround for a hackathon: bump the *package name* in `daml.yaml` (`nhs-budget-app` → `nhs-budget-app-v2`), rebuild, and update every `#nhs-budget` reference in TS (template-id helpers in `live.server.ts`, `DAR_ASSET_PATH` in `deploy-core.server.ts`). Canton treats it as a fresh package; the new templates are immediately usable.

**c. Append to "## Non-negotiables":**

- Never model a free-text field as `Optional Party`. Use `Optional Text` for labels; add a separate `Optional Party` only when an on-chain identity is required.

## 3. No changes to `/hackathon` or `LEARNINGS.md`

Already done last turn. The hackathon page describes counts and tracks, not field types, so it doesn't need touching.

## Files

- `src/routes/deck.tsx` — insert one slide entry into the `SLIDES` array.
- `src/routes/how-it-works.tsx` — extend the `MEGA_PROMPT` template literal.

## Out of scope

- No publish step. User publishes manually.
- No edits to the Daml package, types, or UI — that work shipped last turn and the live smoke is green.
