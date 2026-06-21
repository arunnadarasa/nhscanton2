---
name: canton-fly-deploy
description: Deploy and operate a Canton 3.x Daml participant on Fly.io with the JSON Ledger API v2 — single-machine constraint, RS256 JWT auth, idempotent bootstrap, and submission/contract-payload pitfalls that bite real apps.
---

# Canton on Fly.io

A Canton 3.x participant is a **stateful** Daml ledger node. It exposes the JSON Ledger API v2 on `:7575` and the gRPC ledger-api on `:5011`. Auth is JWT (RS256) — the app mints tokens locally with a private key whose public cert is baked into the participant's config.

## Three invariants (memorize these)

1. **Exactly one Fly machine.** Canton participants don't shard. Two machines = two independent participants = party IDs scattered across two fingerprints (`Name::<fp-A>` vs `Name::<fp-B>`) and `UNKNOWN_RESOURCE` on every cross-machine reference. Pin with `[http_service]` + `flyctl scale count 1`.
2. **Two JWT subjects, two purposes.** `sub: "participant_admin"` (with `participantAdmin: true`) authorizes node ops only — DAR upload, party allocation, user/rights management. It does **not** authorize ledger reads or commands. Create a runtime user (e.g. `lovable-nhs-app`) and grant it `CanActAs` / `CanReadAs` on each party; mint tokens with `sub: "<that user id>"` for all `liveQuery` / `liveCreate` calls.
3. **Bootstrap must be idempotent and token-gated.** It will be re-run after every redeploy, fingerprint change, or scale event. Treat 409/already-exists as success; persist the logical-name → fully-qualified party-id mapping in your backend so the app can resolve `"DHSC"` → `"DHSC::1220…"` at runtime.

## When to read which reference

| You're doing... | Read |
| --- | --- |
| Setting up a brand-new Fly app | `references/fly-single-machine.md` |
| Wiring JWT minting / token cache | `references/jwt-auth.md` |
| Hitting `/v2/dars`, `/v2/parties`, `/v2/users`, `/v2/users/{id}/rights` | `references/json-ledger-api-v2.md` |
| Submitting a command and need the created contract id back | `references/json-ledger-api-v2.md` (Submit a command) |
| Writing or fixing the bootstrap endpoint | `references/bootstrap-flow.md` |
| A ledger call is failing in production | `references/debugging-checklist.md` |

## Minimal bootstrap route skeleton

A token-gated server route that uploads the DAR, allocates parties, creates the runtime user, and grants rights. Idempotent end-to-end. Full canonical version with exact payloads in `references/bootstrap-flow.md`.

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
        // 1. mint admin JWT
        // 2. upload DAR  (409 ok)
        // 3. allocate parties → store {logical_name, party_id} map
        // 4. create runtime user  (409 ok)
        // 5. grant CanActAs/CanReadAs to the user
        // Always capture `await res.text()` on non-2xx and return it — don't swallow errors.
      },
    },
  },
});
```

## Don't repeat these

- Don't use the admin JWT for ledger reads. Won't work. See `jwt-auth.md`.
- Don't `flyctl scale count N` on a Canton app where N > 1. See `fly-single-machine.md`.
- Don't omit `isDeactivated`, `metadata`, or `identityProviderId` from `POST /v2/users`. See `json-ledger-api-v2.md`.
- Don't omit top-level `userId` + `identityProviderId: ""` from `POST /v2/users/{id}/rights`. The rights array uses `{ kind: { CanActAs: { value: { party } } } }` — note the **nested `value`**.
- Don't read `transaction.events` off `/v2/commands/submit-and-wait` — that endpoint returns only `{ updateId, completionOffset }`, no transaction. Use `/v2/commands/submit-and-wait-for-transaction` with the wrapped `{ commands: { commands, userId, commandId, actAs, readAs } }` body. See `json-ledger-api-v2.md`.
- Don't filter contract payloads with `payload.party === "LogicalName"` on the client — payloads carry `LogicalName::<fingerprint>`. Match by prefix (`p.startsWith("LogicalName::")`) or resolve via the bootstrap-persisted mapping. See `debugging-checklist.md`.
- Don't return short, opaque error strings from the bootstrap route. Return the raw response body for each step; you will iterate on this 3+ times.
