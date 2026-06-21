# 01 — LocalNet (laptop + Cloudflare tunnel)

Fastest way to get the Lovable preview talking to a real Canton 3.4
participant. Runs everything on your laptop and exposes the built-in JSON
Ledger API v2 over an HTTPS tunnel.

## 1. Boot the stack

```bash
cd docs/canton-deploy/assets
docker compose up -d postgres canton
docker compose logs -f canton   # wait for "Canton started" + JSON API "Started server"
```

Compose pulls
`europe-docker.pkg.dev/da-images/public/docker/canton-participant:3.4.8`,
which contains the participant **and** the JSON Ledger API v2 on port `7575`.
There is no separate `http-json` container in Canton 3.

## 2. Expose `:7575` over HTTPS

Option A — Cloudflare Tunnel (no account needed for ephemeral URLs):

```bash
nix run nixpkgs#cloudflared -- tunnel --url http://localhost:7575
# → https://<random>.trycloudflare.com
```

Option B — ngrok:

```bash
ngrok http 7575
# → https://<random>.ngrok-free.app
```

Copy the HTTPS URL — that's your `CANTON_JSON_API_URL`.

## 3. Mint a JWT

```bash
cd docs/canton-deploy/assets/jwt
export CANTON_AUTH_SECRET='same value as .env'
bun run issue-dev-token.ts \
  --participant nhs-participant-1 \
  --user lovable-nhs-app
# → eyJhbGciOiJIUzI1NiIs...
```

That string is your `CANTON_JWT`. Canton 3 tokens carry only `sub` + `aud` —
`actAs` is granted server-side via the Users API after parties exist
(`05-upload-dar.md`). See `04-jwt.md` for the full claim shape.

## 4. Upload the DAR + allocate parties

See `05-upload-dar.md`. With LocalNet the JSON API is on
`http://localhost:7575` and the gRPC ledger-api on `localhost:5011`.

## 5. Wire Lovable

In **Project Settings → Secrets** add:

- `CANTON_JSON_API_URL` = the tunnel URL
- `CANTON_JWT` = the token from step 3
- `CANTON_USER_ID` = `lovable-nhs-app` (or whatever you passed to `--user`)
- `CANTON_PARTY_DHSC`, `CANTON_PARTY_NHSE`, `CANTON_PARTY_AUDITOR` = the party
  IDs printed by `POST /v2/parties` (often look like `DHSC::1220abcd...`)

Hit `/api/public/health` on the preview and confirm `"mode":"live"` and
`"liveCheck":{"ok":true,...}`.

## Tearing down

```bash
docker compose down -v   # -v wipes the ledger
```

## Caveats

- Tunnels are ephemeral — restart cloudflared and the URL changes; update the
  Lovable secret.
- JWT signed with the dev HMAC key is fine for demos, **never** for anything
  reachable from the public internet for more than the demo window.
