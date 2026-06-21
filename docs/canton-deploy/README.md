# Canton 3.4 Participant Deployment Guide

This guide shows how to stand up a real **Canton 3.4 participant node** with
the **built-in JSON Ledger API v2** + a **JWT** issuer, upload the
`daml/Nhs.daml` model, and point this Lovable app at the result.

Once the three secrets below are set in Lovable, `ledgerMode()` in
`src/lib/canton/client.server.ts` flips from `memory` to `live` automatically.

> Canton 2.x is legacy. The standalone `digitalasset/http-json` sidecar, the
> `/v1/*` JSON endpoints, the `https://daml.com/ledger-api` JWT claim, and the
> `daml ledger upload-dar` CLI are all gone in Canton 3.x. This guide targets
> the current 3.4 line.

| Secret | Purpose |
| --- | --- |
| `CANTON_DEVNET_JSON_API_URL` | Seaport validator URL (Devnet, recommended) |
| `CANTON_DEVNET_OIDC_TOKEN_URL` | OIDC token endpoint (Authentik) |
| `CANTON_DEVNET_OIDC_AUDIENCE` | `aud` claim the validator expects |
| `CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID` / `_SECRET` | Runtime user (reads + command submission) |
| `CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID` / `_SECRET` | Admin (party alloc, DAR upload, rights grant) |
| `CANTON_FLY_JSON_API_URL` | (paused) Self-hosted Fly.io JSON Ledger API v2 URL |
| `CANTON_FLY_JWT_PRIVATE_KEY` | (paused) RS256 PEM for locally-minted JWTs |
| `CANTON_USER_ID` | Legacy fallback ledger user id (`lovable-nhs-app`); on Devnet derived from the OIDC token `sub` |
| `CANTON_PARTY_DHSC` / `CANTON_PARTY_NHSE` / `CANTON_PARTY_AUDITOR` | Returned by `POST /v2/parties` and stored in `canton_parties` |

## Decision tree

```text
Need a participant reachable from Lovable?
├── Have Encode Hackathon / Seaport creds?  → 08-network-toggle.md  (Seaport Devnet, OIDC — RECOMMENDED)
├── Fastest persistent self-hosted?         → 07-sandbox-bootstrap.md (Fly.io, PAUSED but functional)
├── Hackathon / fastest local?              → Canton Builder Tool   (one command, Splice LocalNet)
│                                              https://github.com/Jatinp26/Canton-Builder-Tool
├── Want full reference stack?              → cn-quickstart         (Keycloak + PQS + sample app)
│                                              https://github.com/digital-asset/cn-quickstart
├── Just demoing locally?                   → 01-localnet.md        (Docker Compose + cloudflared tunnel)
├── Always-on, single VM/host?              → 02-docker.md          (Compose + Caddy + Postgres)
└── Managed PaaS, HTTPS built in?           → 03-fly-io.md          (single Fly app + Fly Postgres)
Then: 04-jwt.md  →  05-upload-dar.md  →  paste secrets into Lovable
Optional: 06-usdcx.md — wrapped-USDC supplier settlement on DevNet
```

> **Default path (post-Encode Hackathon).** Seaport gave us a managed 5N Sandbox validator on Canton Devnet with OIDC `client_credentials` auth. That's now the recommended way to point this app at a real ledger — zero infra, real synchronizer. The Fly.io self-hosted path is **paused** (code still works, switch the header pill to **Fly** to use it). See `08-network-toggle.md` for the full Devnet env-var list.

The **Canton Builder Tool** is the path the Canton Foundation Developer Hub
now recommends for hackathon builders — see
<https://github.com/canton-network-devs/Canton-Developer-Hub>. For our
purposes any of these options produces a participant exposing the same
JSON Ledger API v2 on `:7575`; pick the one that matches your patience.

## Prerequisites

- Docker 24+ and Docker Compose v2 (for local and single-host).
- [Daml SDK 3.4+](https://docs.digitalasset.com/build/3.4/) with the new
  `dpm` toolchain (`daml` Assistant is deprecated in 3.4, removed in 3.5).
- For Fly.io: `flyctl` ≥ 0.3, a Fly account, and a payment method (a small
  Canton 3 participant runs ~$15–30/mo).
- A domain you control if you want a stable HTTPS URL (otherwise use the
  `*.fly.dev` or `*.trycloudflare.com` hostname).

## End-to-end flow

1. Pick a deployment path (`01`, `02`, or `03`) and bring up:
   - `canton` — participant + embedded sequencer/mediator + **built-in JSON
     Ledger API v2** on port `7575`. (No more `http-json` container.)
   - `postgres` — participant index storage
2. Configure JWT (`04-jwt.md`). For dev: HMAC `HS256` matching
   `CANTON_AUTH_SECRET`. For prod: `jwt-rs-256-crt` or `jwt-jwks`.
3. Build (`dpm build`) and upload the DAR, allocate parties (`05-upload-dar.md`).
4. In Lovable: open **Project Settings → Secrets** and add the secrets above.
5. Curl `/api/public/health` on the Lovable preview — it should report
   `{ "mode": "live", "liveCheck": { "ok": true, "offset": "..." } }`.

## Pinned versions

| Component | Image / version |
| --- | --- |
| Canton participant | `europe-docker.pkg.dev/da-images/public/docker/canton-participant:3.4.8` |
| Canton sequencer (multi-node only) | `europe-docker.pkg.dev/da-images/public/docker/canton-sequencer:3.4.8` |
| Canton mediator (multi-node only) | `europe-docker.pkg.dev/da-images/public/docker/canton-mediator:3.4.8` |
| Daml SDK / `dpm` | 3.4.x |
| PostgreSQL | `postgres:16-alpine` |
| Caddy | `caddy:2.8-alpine` |

Check
<https://docs.digitalasset.com/operate/3.4/howtos/download/docker.html> for
newer 3.x tags and bump consistently across all assets.

## Troubleshooting

- **`401 Unauthorized` from JSON API** → JWT `aud` doesn't match
  `target-audience` in `canton.conf`, the signing key differs, or the ledger
  user (`sub`) has no `CanActAs` rights for the party you're submitting for.
  See `04-jwt.md`.
- **`UNKNOWN_TEMPLATE_OR_INTERFACE`** → DAR not uploaded, or template id
  prefix wrong. The app sends `#nhs-budget:Nhs:Template` — make sure the
  Daml package name in `daml.yaml` is still `nhs-budget`.
- **App still shows "SIMULATED LEDGER"** → either `CANTON_JSON_API_URL` or
  `CANTON_JWT` is missing in Lovable secrets. Both must be set.
- **CORS error in browser** → all ledger calls run through `createServerFn`
  on the Lovable Worker, so the browser never talks to the JSON API directly.
  If you see CORS, you're calling it from the client by mistake.
- **`PERMISSION_DENIED: requires admin`** → DAR uploads and party
  allocation need a token with `scope: "daml_ledger_api admin"`. The dev
  token script supports `--admin`; the runtime app token should not.
