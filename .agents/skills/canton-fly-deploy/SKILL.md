---
name: canton-fly-deploy
description: Deploy and operate a Canton 3.x participant for a Daml app — either on a managed Seaport / Canton Network Devnet validator (default) or self-hosted on Fly.io. Covers JSON Ledger API v2, JWT and OIDC auth, the idempotent bootstrap (DAR upload, party allocation, user + rights), DAR lifecycle and upgrade traps, mock-USDCx, and the failure modes that took us hours to find.
---

# Canton deploy (Seaport Devnet & Fly.io self-host)

A Canton 3.x participant is a **stateful** Daml ledger node. It exposes the JSON Ledger API v2 on `:7575` (gRPC on `:5011`). Auth is a bearer JWT. The validator either runs **for you** (Seaport / Canton Network Devnet → OIDC `client_credentials` against an external IdP) or **on your infra** (Fly.io single-machine → locally-minted RS256 JWTs). Everything else — `/v2/dars`, `/v2/parties`, `/v2/users`, `/v2/commands/*` — is identical.

## Pick your path

| | Seaport Devnet (recommended) | Fly.io self-host |
| --- | --- | --- |
| Token | OIDC `client_credentials`, cached | RS256, minted in-process |
| Subjects | `BOOTSTRAP_CLIENT_ID` + `RUNTIME_CLIENT_ID` | `participant_admin` + runtime user id |
| Synchronizer | Canton Devnet global synchronizer | Embedded, single-participant |
| Infra cost | $0 | ~$20/mo |
| Ledger `userId` | **MUST equal the runtime token's `sub` claim** | You choose (e.g. `lovable-nhs-app`) |
| Party count visible from `/v2/parties` | 10k+ — must paginate | a handful |

Default to Devnet for hackathons and demos. Fall back to Fly only if you need full control of the participant or you're offline.

## Four invariants (memorize these)

1. **Two token subjects, two purposes.** An admin subject (`participant_admin` on Fly, the bootstrap OIDC client on Devnet) authorizes node ops only — DAR upload, party allocation, user/rights management. It does **not** authorize ledger reads or commands. A runtime subject — granted `CanActAs` / `CanReadAs` on each party — is what every `liveQuery` / `liveCreate` token must carry.
2. **Bootstrap must be idempotent and token-gated.** It will be re-run after every redeploy, fingerprint change, scale event, or new DAR. Treat 409/already-exists as success; persist the logical-name → fully-qualified party-id mapping so the app can resolve `"DHSC"` → `"DHSC::1220…"` at runtime.
3. **`userId === token.sub` on networks you don't control.** On Devnet the validator enforces that the `userId` field in every command submission matches the runtime token's `sub` (or `applicationId`) claim. Decode the JWT, pull `sub`, and use that as both the command `userId` AND the user you grant party rights to. Hardcoding `userId: "lovable-nhs-app"` returns an opaque **`403 security-sensitive error`** with no detail.
4. **DAR upgrade = rename, not bump.** Renaming or retyping a field on an installed template is not a backward-compatible upgrade in Canton's package-version checks. Re-uploading at a bumped patch version (`1.0.0 → 1.0.1`) under the same package name fails with `KNOWN_PACKAGE_VERSION`. For hackathon-pace iteration: bump the package **name** (`nhs-budget-app` → `nhs-budget-app-v2`) in `daml.yaml` and update every `#nhs-budget` reference in TS.

*Fly-only invariant: exactly one machine.* Canton participants don't shard. Two machines = two participants = party IDs scattered across two fingerprints (`Name::<fp-A>` vs `Name::<fp-B>`) and `UNKNOWN_RESOURCE` on every cross-machine reference. Pin with `[http_service]` + `flyctl scale count 1`. See `references/fly-single-machine.md`.

## When to read which reference

| You're doing... | Read |
| --- | --- |
| Wiring up Seaport / Canton Network Devnet (OIDC, secrets, cookie override) | `references/seaport-devnet.md` |
| Setting up a brand-new Fly app | `references/fly-single-machine.md` |
| Wiring JWT minting (RS256) or OIDC client-credentials token caching | `references/jwt-auth.md` |
| Hitting `/v2/dars`, `/v2/parties`, `/v2/users`, `/v2/users/{id}/rights` | `references/json-ledger-api-v2.md` |
| Submitting a command and need the created contract id back | `references/json-ledger-api-v2.md` (Submit a command) |
| Writing or fixing the bootstrap endpoint | `references/bootstrap-flow.md` |
| Building / re-uploading DARs, package-name renames, free-text vs Party | `references/dar-lifecycle.md` |
| A ledger call is failing in production | `references/debugging-checklist.md` |

## Minimal bootstrap route skeleton

A token-gated server route that uploads the DAR(s), allocates parties, creates the runtime user, and grants rights. Idempotent end-to-end. Full canonical version in `references/bootstrap-flow.md`.

```ts
// src/routes/api/public/admin.deploy.ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admin/deploy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-deploy-token") !== process.env.DEPLOY_ADMIN_TOKEN) {
          return new Response("Unauthorized", { status: 401 });
        }
        // 1. mint admin token (RS256 on Fly, OIDC client_credentials on Devnet)
        // 2. upload DAR(s)            (409 ok). Re-upload on every deploy to avoid stale package ids.
        // 3. allocate parties         → store {logical_name, party_id} map
        // 4. create/upsert runtime user. On Devnet: id = runtime token's `sub`.
        // 5. grant CanActAs + CanReadAs on EVERY party (no Auditor exception — see Lesson A)
        // Always capture `await res.text()` on non-2xx and return it — don't swallow errors.
      },
    },
  },
});
```

## Don't repeat these

### Auth & users
- **Don't use the admin/bootstrap token for ledger reads.** Won't work. See `jwt-auth.md`.
- **Don't hardcode `userId` on Devnet.** Derive it from the runtime token's `sub` claim. Symptom: opaque `403 security-sensitive error`.
- **Don't grant `CanReadAs` only to your observer party.** If the party is also a signatory on any template you create (e.g. Auditor as issuer of mock-USDCx), it needs `CanActAs` too. Same opaque `403` if missing.

### JSON Ledger API v2
- **Don't omit `isDeactivated`, `metadata`, or `identityProviderId`** from `POST /v2/users`. See `json-ledger-api-v2.md`.
- **Don't omit top-level `userId` + `identityProviderId: ""`** from `POST /v2/users/{id}/rights`. The rights array uses `{ kind: { CanActAs: { value: { party } } } }` — note the **nested `value`**.
- **Don't read `transaction.events` off `/v2/commands/submit-and-wait`** — it returns only `{ updateId, completionOffset }`. Use `/v2/commands/submit-and-wait-for-transaction` with the wrapped `{ commands: { commands, userId, commandId, actAs, readAs } }` body.
- **Don't fetch `/v2/parties` without paging on Devnet.** It returns 10k+ parties. Use `pageSize=2000` and build a local map once per bootstrap.

### Daml modelling
- **Don't model free-text as `Optional Party`.** A `Party` must be a real ledger participant; sending user-typed text ("AstraZeneca") fails with `UNKNOWN_INFORMEES` at submission. Use `Optional Text` for the label and a separate `Optional Party` for the on-chain identity if you need both. See `references/dar-lifecycle.md`.
- **Don't bump only the package version** for a breaking schema change. Bump the package **name** to dodge `KNOWN_PACKAGE_VERSION`. See `references/dar-lifecycle.md`.
- **Don't trust a redeploy to install a new DAR by hash.** Force re-upload on every deploy so the package id the app references is always live. Symptom: `Couldn't find template …` after a successful deploy.

### Client / payloads
- **Don't filter contract payloads with `payload.party === "LogicalName"`** — payloads carry `LogicalName::<fingerprint>`. Match by prefix or resolve via the bootstrap mapping. See `debugging-checklist.md`.

### Ops
- **Don't `flyctl scale count N`** on a Canton app where N > 1. See `fly-single-machine.md`.
- **Don't flip `CANTON_MODE` globally** when one endpoint needs a different network. Read a `canton_network` cookie per-request and fall back to `CANTON_MODE`. See `references/seaport-devnet.md`.
- **Don't serve `.dar` files through Cloudflare** — the extension is blocked. Rename the asset to `.dar.bin` and content-type it as `application/octet-stream`.
- **Don't return short, opaque error strings from the bootstrap route.** Return the raw response body for each step; you will iterate on this 3+ times.
