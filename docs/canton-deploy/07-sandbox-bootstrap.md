# 07 — Sandbox-as-Deployer (Fly.io)

The Lovable sandbox is a real Linux box with `curl`, `nix`, `bun`, `openssl`,
and persistent `/mnt/documents/`. The runtime workerd can't shell out to
`flyctl`; the sandbox can. This doc uses that asymmetry to provision the
three secrets the app needs — **`CANTON_JSON_API_URL`**, **`CANTON_ADMIN_JWT`**,
and **`DEPLOY_ADMIN_TOKEN`** — in one chat turn.

## You provide

One secret, once: `FLY_API_TOKEN` (from `fly tokens create org`).

Optionally override `FLY_ORG`, `FLY_REGION` (default `lhr`), `APP_NAME`,
`JWT_TTL_SECONDS` (default 90 days).

## Run it

```bash
export FLY_API_TOKEN=fo1_…
bash scripts/build-dar.sh           # if you haven't already
bash scripts/deploy-canton-fly.sh
```

The script:

1. Installs `flyctl` to `/tmp/flyctl` (cached across runs).
2. Generates `CANTON_AUTH_SECRET`, `DEPLOY_ADMIN_TOKEN`, Postgres password
   with `openssl rand -hex 32`.
3. Stages `docs/canton-deploy/assets/fly/Dockerfile` + `canton.conf` +
   `bootstrap.canton` + the bundled DAR.
4. Renders `fly.toml.template` → `fly.toml` with your app name and region.
5. Creates the Fly app + Fly Postgres, attaches them, sets secrets, and
   `flyctl deploy --remote-only`.
6. Polls `https://<app>.fly.dev/v2/state/ledger-end` until it returns `401`
   (JSON API up, no token = expected).
7. Reuses `docs/canton-deploy/assets/jwt/issue-dev-token.ts` to sign the
   HS256 admin JWT with the right `aud` for Canton 3.
8. Re-checks the URL with the JWT — must return `200`.
9. Prints the three secrets, also writes them to
   `/mnt/documents/canton-secrets.txt` and a `rotate-jwt.sh` helper.

## Paste into Lovable

Open **Project Settings → Secrets** and add:

| Secret | Value |
|---|---|
| `CANTON_JSON_API_URL` | `https://<app>.fly.dev` |
| `CANTON_ADMIN_JWT` | the printed JWT |
| `DEPLOY_ADMIN_TOKEN` | the printed token |
| `CANTON_USER_ID` | `lovable-nhs-app` |

Then go to `/deploy`, paste `DEPLOY_ADMIN_TOKEN`, click **Deploy now**. The
runtime route uploads the DAR, allocates DHSC / NHSEngland / Auditor + ICB
+ Trust parties, creates the ledger user, returns party IDs. Paste them
back into Secrets as `CANTON_PARTY_DHSC`, `CANTON_PARTY_NHSE`,
`CANTON_PARTY_AUDITOR`.

## Re-running and rotating

- Re-running the script with the same `FLY_API_TOKEN` reuses the same app
  name (derived from the token hash). It will redeploy and mint a fresh
  JWT — paste the new JWT, leave the URL alone.
- To rotate just the JWT later: `bash /mnt/documents/rotate-jwt.sh`.
- To rotate the HMAC secret: re-run the whole script with `APP_NAME=…`
  pointing at the same app; `flyctl secrets set CANTON_AUTH_SECRET=…` will
  trigger a redeploy and invalidate every outstanding JWT.

## Tear down

```bash
flyctl apps destroy <app-name> --yes
flyctl postgres destroy <app-name>-db --yes
```

## Caveats

- `unsafe-jwt-hmac-256` is dev-only per the Canton docs. For anything
  exposed to real users, swap to `jwt-jwks` / `jwt-rs-256-crt` in
  `canton.conf` (see `04-jwt.md`) and emit RS256 tokens from your OIDC
  provider.
- `min_machines_running = 1` keeps the participant warm; expect ~$10–15/mo
  on Fly's smallest shared-CPU machine + Fly Postgres.
- `FLY_API_TOKEN` should be an **org-scoped deploy token**, not a user
  token. After the first run, `fly tokens create deploy <app-name>` and
  rotate to a narrower app-scoped token.
- The script writes the auth secret and JWT to `/mnt/documents/` — that's
  user-visible storage in the sandbox, fine for your own use but treat
  the file as sensitive.
