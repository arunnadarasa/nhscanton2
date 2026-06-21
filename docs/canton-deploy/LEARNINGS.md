# Canton on Fly.io — Learnings, Failures, and Best Practices

A debrief of what it took to get a Canton 3.4 participant running on Fly.io with the NHS budget app talking to its JSON Ledger API v2. Written after the live ledger was working end-to-end; intended to make the next deploy boring.

> **Status update (Encode Hackathon).** The Fly.io self-hosted path is **paused**. Encode provisioned us with **Seaport-managed Devnet** access (a 5N Sandbox validator, OIDC `client_credentials` for both bootstrap and runtime users). Devnet gives us a real shared synchronizer, no infra ops, no $20/mo bill — so all active demos now run on Devnet via the header pill. The Fly.io code path still works (`CANTON_FLY_*` env namespace + `localnet` toggle) and everything below remains accurate for anyone who wants to self-host. See **"Encode Hackathon → Seaport Devnet shortcut"** below for the path we now recommend by default.

## TL;DR


| Theme | Lesson |
| --- | --- |
| Stateful service on Fly | Pin to exactly 1 machine. Always. |
| Canton JWT auth | Two subjects: `participant_admin` for node ops, runtime user for reads/writes. They are not interchangeable. |
| JSON Ledger API v2 | Schemas differ from v1 in non-obvious ways — most v2 endpoints want extra envelope fields (`isDeactivated`, `metadata`, `identityProviderId`, nested `value`). |
| Bootstrap | Make it idempotent, token-gated, and return raw response bodies from every step. |
| Iteration speed | Always surface upstream error bodies. We lost the most time to early code that returned `created: false` with no detail. |

## What worked first try

- **Fly app creation + persistent volume.** `flyctl apps create` + `[[mounts]]` for `/canton/data` worked exactly as documented.
- **RS256 keypair + locally-minted JWTs.** Generating the key with `cryptography`, baking the public cert into the Docker image, and signing tokens with `jose` server-side. No moving parts, no rotating service.
- **DAR upload.** `POST /v2/dars` with `application/octet-stream` and the raw bytes. 200 first time, 409 thereafter.
- **Party allocation API.** `POST /v2/parties { partyIdHint }` returned `partyDetails.party` cleanly.
- **TanStack Start server routes under `/api/public/*`.** Bypassed published-site auth so the bootstrap endpoint could be hit programmatically without OAuth.

## What broke, in chronological order

### 1. `PERMISSION_DENIED` on every ledger read in live mode

**Symptom.** `getActiveContracts`, `liveQuery("Nhs:…", "Auditor")` — everything blew up with `PERMISSION_DENIED`.

**Root cause.** The app was signing every request with the admin JWT (`sub: participant_admin`). That grant covers node-admin endpoints (party allocation, DAR upload, user mgmt) but **does not** authorize ledger reads or command submission. Canton 3 requires every read to carry a user whose rights include `CanReadAs(<party>)` for each party in the query.

**Fix.** Split the token minting into two functions: `getCantonAdminAccessToken()` for the bootstrap route, `getCantonLedgerAccessToken()` (subject = a runtime user we create) for all ledger calls. Cache both with a 30s safety margin under their 5-min TTL.

**Cost.** ~2 hours of staring at "but I'm passing a valid token" before realizing valid ≠ authorized.

### 2. `400 Invalid value for: body` on `POST /v2/users/{id}/rights`

**Symptom.** Bootstrap got all the way to step 5 (rights grant), then 400.

**Root cause.** Two layered v2 schema surprises:

1. The rights array uses a **doubly-nested** envelope: `{ kind: { CanActAs: { value: { party: "..." } } } }`. We had `{ kind: { CanActAs: { party: "..." } } }` by analogy with v1.
2. The request body requires top-level `userId` and `identityProviderId: ""` even though the URL path already includes the user id.

**Fix.** Both changes in one edit; rights grant returned 200 with `newlyGrantedRights: [...]`.

### 3. `404 USER_NOT_FOUND` after fixing the rights shape

**Symptom.** Rights call now structurally valid, but Canton said the user we'd "just created" doesn't exist.

**Root cause.** Two Fly machines were running. We were creating the user on one, granting rights on the other. The bootstrap response itself was the smoking gun — half the party IDs ended in `::1220c1b6…` and the other half in `::12204021…`. Two participants, two fingerprints, served interchangeably by Fly's load balancer.

**Fix.** Destroyed one machine (`flyctl machines destroy <id> --force`), updated `fly.toml` to pin single-machine via `[http_service]` + `min_machines_running = 1` + `auto_stop_machines = false`, added `flyctl scale count 1` to the deploy script. Re-ran bootstrap — all party IDs collapsed to one fingerprint.

**Cost.** ~1 hour, because the failure mode was "almost works", which is the worst kind.

### 4. `400 Missing required field at 'isDeactivated'` on `POST /v2/users`

**Symptom.** After destroying the duplicate machine, the user had to be recreated on the survivor. The create call started failing.

**Root cause.** The v2 user-create endpoint requires the full user object: `id`, `primaryParty`, `isDeactivated`, `metadata: { resourceVersion, annotations }`, `identityProviderId`. We were only sending `id` and `primaryParty` (which had worked... or so we thought; possibly the first user creation happened on a Canton build that was more lenient, or we just got lucky with defaulting on the now-dead machine).

**Fix.** Sent the full object. 200 OK.

### 5. Self-deploy ergonomics

**Symptom.** Hitting `/api/public/admin/deploy` from `curl` required pasting the deploy token each time, and from the browser meant building a UI we didn't want yet. The published-site auth wrapper also fronts non-`/api/public/*` paths, so debugging endpoints had to be carefully prefixed.

**Fix.** Added a temporary `/api/public/admin/self-deploy` route that reads the token from `process.env.DEPLOY_ADMIN_TOKEN` server-side and proxies to the real deploy endpoint. Used `stack_modern--invoke-server-function` to fire it. To be deleted once the live ledger has been initialized.

## Root-cause taxonomy

Most of the wasted time fell into three buckets:

1. **Auth scope conflation.** "It's authenticated" is not the same as "it's authorized for this scope". Admin ≠ ledger user. Required reading Canton's permission model.
2. **Multi-machine on a stateful service.** Fly's defaults assume stateless web apps. They don't fit Canton. The fix is a fly.toml block, not a runtime workaround.
3. **API v2 ≠ API v1.** The v2 endpoints have stricter required-field validation and different payload nesting than the v1 `http-json` sidecar. Don't write payloads from memory; verify against the v2 OpenAPI spec or a known-good `curl`.

## Best practices going forward

### Fly deployment

- Single-machine `[http_service]` block in the initial template.
- Always end deploys with `flyctl scale count 1 -a <app> --yes`.
- 4 GB / 2 shared CPUs minimum. Anything less OOMs.
- Health check on `/v2/state/ledger-end` — accept 401 (unauth) as "alive".
- Persist `canton_data` on a Fly volume. Re-creating the volume regenerates the participant fingerprint, which invalidates every stored party ID.

### Auth

- Two JWT subjects. Cache both. Re-mint, don't refresh.
- Store the private key as base64-encoded PEM so it survives any UI paste. Decode on first read.
- Public cert baked into the Docker image; don't ship it as a secret (it's public by design).

### Bootstrap route

- Token-gated, idempotent, replayable.
- Returns full response bodies on every step from day one. `result.user.createBody.slice(0, 500)` saved hours once added.
- Persist the logical-name → party-id map in a backend table. Never hard-code party fingerprints.
- Treat 409 from DAR and user create as success.
- After party allocation, search by `party.startsWith(hint + "::")` to handle already-allocated cases.

### App-side resolution

- Server-only `resolveParty(hint)` that loads the map once per isolate. Throw a friendly "run /deploy" error if a hint is unmapped.
- Wallet SDK clients with `auth.method: "static"` must rebuild on token rotation. Cache by token value.

## Encode Hackathon → Seaport Devnet shortcut

Two months after the Fly.io path was working, the Encode Hackathon gave us access to a **Seaport-managed Devnet validator** (a 5N Sandbox node on Canton Devnet). It collapses most of this document down to "paste five secrets":

- `CANTON_DEVNET_JSON_API_URL` — Seaport's validator URL
- `CANTON_DEVNET_OIDC_TOKEN_URL` — Authentik token endpoint
- `CANTON_DEVNET_OIDC_AUDIENCE` — the `aud` the validator expects
- `CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID` / `_SECRET` — runtime user (reads/writes)
- `CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID` / `_SECRET` — admin (party alloc, DAR upload)

Then flip the header pill to **Seaport** and run `/deploy` once. Bootstrap is the same idempotent route — only the token source changes (OIDC `client_credentials` instead of locally-minted RS256). No Fly machine, no Postgres, no DAR baking into a Docker image.

### What's different from the Fly.io path

| | Fly.io (self-hosted) | Seaport Devnet |
|---|---|---|
| Token | RS256, minted in-Worker | OIDC `client_credentials`, cached |
| Two subjects | `participant_admin` + runtime user | `BOOTSTRAP_CLIENT_ID` + `RUNTIME_CLIENT_ID` |
| Synchronizer | Embedded (single-participant) | Canton Devnet global synchronizer |
| Infra cost | ~$20/mo | $0 |
| Ledger user id | We chose `lovable-nhs-app` | Token `sub` claim (e.g. `"6"`) — see below |

### The Devnet-specific gotcha: `userId` MUST match the token `sub`

On Devnet the validator enforces that the `userId` field in every command submission matches the `sub` (or `applicationId`) claim of the bearer token. The Fly.io setup let us hardcode `userId: "lovable-nhs-app"` because we controlled both ends. On Devnet that returns a **403 "security-sensitive" error** with no detail (deliberately — leaking the expected user id would itself be a leak).

Fix: decode the runtime OIDC token, pull `sub`, use that as the command `userId` and as the user we grant party rights to. `getRuntimeLedgerUserId()` in `src/lib/canton/tokens.server.ts` does this; the bootstrap route then grants rights to the same derived id.

### Status of the Fly.io path

Paused, not deleted. `scripts/deploy-canton-fly.sh`, `docs/canton-deploy/03-fly-io.md`, `docs/canton-deploy/07-sandbox-bootstrap.md`, and the `CANTON_FLY_*` env namespace are all still wired up. Switch the header pill to **Fly** if you want to use it; the code paths are exercised in CI. We just don't recommend it as the default for hackathon builders any more — Devnet is free, multi-party, and already running.

## What I'd do differently next time

1. **Try Devnet first.** Before any Docker / Fly / Postgres work, check whether a managed Devnet validator is available (Seaport, Canton Foundation, your hackathon sponsor). 90% of what's documented above is irrelevant when someone else runs the participant.
2. **Read the v2 OpenAPI spec before writing payloads.** Especially for `/v2/users` and `/v2/users/{id}/rights`. The schema is the source of truth; analogizing from v1 docs cost two iterations.
3. **Ship the single-machine `[http_service]` block from the start** (Fly path only). It's free safety; not having it bit us once and would have bit us again on every redeploy.
4. **Log the participant fingerprint on every bootstrap response.** A one-line "all parties on fingerprint X" check at the end would have caught the multi-machine drift immediately instead of staring at scattered IDs.
5. **Return raw upstream bodies on every step, always.** No "`created: false`" booleans. Just `{ status, ok, body }`. Costs nothing, saves hours.
6. **Derive the ledger `userId` from the runtime token** on any network you don't control end-to-end. Hardcoding it works on Fly because you own the IdP; on Devnet it returns an opaque 403.
7. **Pin Canton image + DAR versions in the same release.** Today they're loosely coupled; an image change with a stale DAR would be a quiet failure.
8. **Add an automated post-deploy smoke test.** One curl that mints a runtime token, fetches `/v2/state/ledger-end`, and confirms 200. Exit non-zero in CI on failure.


## Quick-reference cheatsheet

### Fly toml block (single-machine, stateful)

```toml
[[mounts]]
  source = "canton_data"
  destination = "/canton/data"

[http_service]
  internal_port = 7575
  force_https = true
  auto_stop_machines = false
  auto_start_machines = false
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus     = 2
  memory_mb = 4096
```

### Create user (v2)

```json
POST /v2/users
{
  "user": {
    "id": "lovable-nhs-app",
    "primaryParty": "",
    "isDeactivated": false,
    "metadata": { "resourceVersion": "", "annotations": {} },
    "identityProviderId": ""
  }
}
```

### Grant rights (v2)

```json
POST /v2/users/lovable-nhs-app/rights
{
  "userId": "lovable-nhs-app",
  "identityProviderId": "",
  "rights": [
    { "kind": { "CanActAs":  { "value": { "party": "DHSC::1220..." } } } },
    { "kind": { "CanReadAs": { "value": { "party": "Auditor::1220..." } } } }
  ]
}
```

### Two-subject JWT claims

```
admin:  { sub: "participant_admin",   aud: "canton-ledger-api", participantAdmin: true, scope: "daml_ledger_api daml_ledger_api.admin" }
runtime:{ sub: "lovable-nhs-app",     aud: "canton-ledger-api",                          scope: "daml_ledger_api daml_ledger_api.admin" }
```

### Post-deploy single-machine enforcement

```bash
flyctl scale count 1 -a "$APP_NAME" --yes
flyctl machines list -a "$APP_NAME"      # confirm exactly 1
```
