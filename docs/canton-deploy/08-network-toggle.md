# 08 — Network toggle: Seaport ↔ Fly

> **Default (Encode Hackathon).** Seaport-managed Devnet is the recommended path. Encode provided a 5N Sandbox validator with OIDC `client_credentials` for both bootstrap and runtime users — no infra to run. The Fly.io self-hosted path is **paused** (code is still functional; flip the header pill to **Fly** to use it).

The header pill in the app is a 3-way segmented toggle:

| Option    | Network        | What it talks to                                          |
| --------- | -------------- | --------------------------------------------------------- |
| **Memo**  | `memory`       | In-process demo ledger (always available)                 |
| **Fly**   | `localnet`     | Self-hosted Canton participant (Fly.io, laptop) — paused  |
| **Seaport** | `devnet`     | Seaport-managed 5N Sandbox validator (Devnet) — default   |

Clicking an option writes a `canton_network` cookie. Every server function /
server route reads the cookie via `currentCantonNetwork()` and picks the
matching env-var namespace. Disabled options show a tooltip naming the
secrets that are still missing.

## Per-network env vars

Each `CANTON_*` secret is looked up in this order:

1. `CANTON_FLY_<NAME>` (when toggle = Fly) or `CANTON_DEVNET_<NAME>` (when toggle = Seaport)
2. `CANTON_<NAME>` (legacy, applies to whichever network is active)

| Purpose              | Fly                                      | Seaport                                   |
| -------------------- | ---------------------------------------- | ----------------------------------------- |
| JSON API URL         | `CANTON_FLY_JSON_API_URL`                | `CANTON_DEVNET_JSON_API_URL`              |
| Admin API URL        | `CANTON_FLY_ADMIN_API_URL`               | `CANTON_DEVNET_ADMIN_API_URL`             |
| Auth — RS256 key     | `CANTON_FLY_JWT_PRIVATE_KEY`             | —                                         |
| Auth — OIDC          | —                                        | `CANTON_DEVNET_OIDC_TOKEN_URL`<br>`CANTON_DEVNET_OIDC_AUDIENCE`<br>`CANTON_DEVNET_OIDC_SCOPE`<br>`CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID`<br>`CANTON_DEVNET_OIDC_RUNTIME_CLIENT_SECRET`<br>`CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID/SECRET` (optional)<br>`CANTON_DEVNET_OIDC_STATIC_TOKEN` (smoke-test escape hatch) |
| Ledger user          | `CANTON_FLY_USER_ID`                     | `CANTON_DEVNET_USER_ID`                   |
| USDCx package id     | `CANTON_FLY_USDCX_PACKAGE_ID`            | `CANTON_DEVNET_USDCX_PACKAGE_ID`          |

If only legacy `CANTON_*` vars are set, the app keeps working — the toggle
just shows that one network as available.

## How it picks the active network

`currentCantonNetwork()` in `src/lib/canton/mode.server.ts`:

1. **Cookie** — `canton_network=fly|seaport|memory`, only honored if that network has secrets configured.
2. **`CANTON_MODE`** env var (`localnet` | `devnet` | `memory`) — operator default.
3. **Auto-detect** — picks `devnet` if OIDC creds are present, else `localnet` if a private key is present, else `memory`.

## Caches

Tokens are minted on demand and cached by `(network, kind)`. Toggling the
header pill doesn't invalidate the cache; the new network just hits an empty
cache slot and mints fresh tokens against its own participant.

## Parties

Party fingerprints live in the `canton_parties` table and are resolved by
logical name (e.g. `"DHSC"` → `"DHSC::1220..."`). Each network you point at
needs its own bootstrap run (`/api/public/admin/deploy`) so the table holds
the right fingerprint for the currently-active participant.

## Caveats

- The toggle is per-browser (cookie). Multiple demoers can each pick their own network.
- Switching networks does **not** migrate contracts — each ledger has its own state.
- The bootstrap endpoint always uses the *currently active* network. Run it once per network.
