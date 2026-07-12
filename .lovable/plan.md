Update the active `canton-fly-deploy` skill so future agents inherit the lessons from this NHS Canton project. Draft under `.agents/skills/canton-fly-deploy/` then apply via `skills--apply_draft`.

## Edits to `SKILL.md`

1. **Reinforce Devnet-first framing** in the intro paragraph and the "Pick your path" table caption. Keep the skill name (`canton-fly-deploy`) — renaming would break the existing retrieval slug.
2. **Add a 5th invariant** to the "Four invariants" block (rename to "Five invariants"):
   > **SHA-256 commitment parity.** If your Daml template stores commitments (`hashText <fields>`), the on-ledger `hashText` and the frontend pre-image hash MUST produce identical bytes. Use `import DA.Text (sha256)` + `hashText t = sha256 t` in Daml, and a real SHA-256 in TS (Web Crypto `crypto.subtle.digest("SHA-256", ...)` or an inline FIPS 180-4 impl). Identity hashes ("just return the text") silently work locally then fail audit-time reconciliation.
3. **Add a new "App architecture" section** (short, above "Don't repeat these") pointing to three new reference files:
   - `references/mode-runtime.md` — the `memory | localnet | devnet` runtime switcher (`src/lib/canton/mode.server.ts`), per-request cookie override, persisted execution log, memory-mode fallback for offline demos.
   - `references/create-contract-ui.md` — the generic Create-Contract pattern: a `templates.ts` registry describes every template (id, package, module, entity, fields with hashing hints), driving one dynamic form at `/contracts/new` that calls a single `createCommand` server function.
   - `references/commitment-hashing.md` — SHA-256 parity between Daml `hashText` and the frontend, including the "encode as UTF-8 → hex-lowercase" convention and a test recipe (round-trip a sample string in both languages, assert equal).
4. **Expand the "When to read which reference" table** with rows for the three new files.
5. **Add three new "Don't repeat these" bullets** (grouped under a new **App integration** subsection):
   - Don't ship an identity `hashText` — Daml and TS must both SHA-256 the same UTF-8 bytes.
   - Don't scatter template-specific create forms across routes — use one registry-driven form.
   - Don't hardcode the ledger network — read a per-request `canton_network` cookie, fall back to `CANTON_MODE`, and always keep `memory` mode as an offline demo path.

## New reference files (concise, ~40-80 lines each)

- `references/commitment-hashing.md` — Daml snippet, TS snippet (Web Crypto preferred, inline fallback for edge runtimes without subtle), parity-test recipe, common divergences (utf-8 vs utf-16, hex casing, trimming).
- `references/create-contract-ui.md` — template registry shape, dynamic form generation, `hashedFrom` field pointer, single `createCommand` server function, why grouping templates by domain (Budget Allocation / Spend Commitment / Reconciled Spend / Settlement / Invoice) beats grouping by tech concern.
- `references/mode-runtime.md` — `getLedgerMode()` server fn, `setCantonNetwork` mutation, `canton_network` cookie precedence over `CANTON_MODE`, memory-mode implementation notes, persisted execution log for demo replay.

## Hand-off

After writing the draft under `.agents/skills/canton-fly-deploy/`, call `skills--apply_draft` with path `.agents/skills/canton-fly-deploy` so the workspace skill updates.

## Out of scope

- No changes to the existing 7 reference files.
- No skill rename.
- No changes to the project's own code.
