## Goal

Update the `canton-fly-deploy` skill so future agents default to **Seaport Devnet** (the path we now actually use) while keeping the Fly.io self-host path available. Fold in the hard-won learnings from `docs/canton-deploy/LEARNINGS.md` (auth scopes, JSON API v2 quirks, DAR upgrade traps, mock-USDCx, cookie-based per-request override).

## Approach

Skills are immutable in `.workspace/skills/`. I'll copy the current skill into `.agents/skills/canton-fly-deploy/`, edit there, then apply via `skills--apply_draft`. Rename is risky (would orphan retrieval); keep the name `canton-fly-deploy` and broaden its scope in the description + body.

## Changes

### `SKILL.md` (rewrite)
- New frontmatter description: covers both Seaport-managed Devnet **and** Fly.io self-host; triggers on "Canton", "Daml ledger", "JSON Ledger API v2", "Seaport", "Devnet", "DAR upload", "party allocation".
- New top section: **"Pick your path"** — Devnet first (recommended), Fly.io second (self-host).
- Keep the three invariants, generalize #1 (single-machine) to apply to Fly only; add a fourth invariant: **package-name resolution + DAR upgrade rules**.
- Expand "Don't repeat these" with the new failure modes:
  - Runtime user needs `CanActAs` on **every** party that signs (including Auditor when it's an issuer).
  - Free-text fields must be `Optional Text`, not `Optional Party`.
  - On a network you don't own, derive ledger `userId` from the runtime token `sub` claim.
  - Schema changes → bump package **name** (`-v2`), not just version, to dodge `KNOWN_PACKAGE_VERSION`.
  - `/v2/parties` paginates — use `pageSize` and build a local map (Devnet returns 10k+ parties).
  - Don't ship `.dar` over Cloudflare CDN; rename to `.dar.bin`.
  - Per-request network override via `Cookie: canton_network=...` instead of flipping `CANTON_MODE` globally.
- Add a "When to read which reference" row for Seaport.

### New reference: `references/seaport-devnet.md`
- OIDC `client_credentials` flow (two clients: bootstrap + runtime).
- Required secrets list (`CANTON_DEVNET_JSON_API_URL`, `_OIDC_TOKEN_URL`, `_AUDIENCE`, `_SCOPE`, `_OIDC_RUNTIME_CLIENT_ID/_SECRET`, bootstrap pair).
- `userId === token.sub` rule + how to decode.
- Cookie-based per-request override pattern.
- Paginated party resolution snippet.
- Mock-USDCx mint pattern + Auditor `CanActAs` requirement.
- Diff table vs Fly.io path.

### New reference: `references/dar-lifecycle.md`
- Build with `dpm` / Daml SDK 3.5.x.
- `KNOWN_PACKAGE_VERSION` trap → rename package, don't bump patch, for breaking schema changes.
- Free-text vs Party modelling rule with example (`supplierName : Optional Text` + `supplierParty : Optional Party`).
- Multi-DAR uploads (main app + mock-usdcx) in deploy order.
- `#<package-name>:Module:Template` resolution on JSON v2 → no need to pin package hashes for demo DARs.
- Cloudflare `.dar` → `.dar.bin` workaround.

### Update `references/bootstrap-flow.md`
- Add Seaport variant of step 1 (mint OIDC token instead of RS256).
- Grant `CanActAs` to **all** parties (drop the Auditor exception).
- Note paginated `/v2/parties` resolution.
- Add step 6: optional second-DAR upload (mock-USDCx) + mint flow.

### Update `references/debugging-checklist.md`
- Add: opaque `403 "security-sensitive error"` → almost always missing `CanActAs` on a signatory.
- Add: `UNKNOWN_INFORMEES` → free-text typed as `Party`.
- Add: package-id mismatch after redeploy → DAR not re-uploaded; force re-upload on every deploy.

### Update `references/jwt-auth.md`
- Add OIDC `client_credentials` section alongside RS256.
- Add `getRuntimeLedgerUserId()` pattern (decode `sub`).

### Untouched
- `references/fly-single-machine.md` — still accurate.
- `references/json-ledger-api-v2.md` — still accurate; light additions only if needed (pagination note).

## Hand-off

After writing, call `skills--apply_draft` on `.agents/skills/canton-fly-deploy`.
