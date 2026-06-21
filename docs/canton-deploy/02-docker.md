# 02 — Single-host Docker Compose

Always-on Canton 3.4 participant on a VM (Hetzner CX22, DO droplet,
EC2 t4g.small, etc.). TLS terminated by Caddy with automatic Let's Encrypt.
The JSON Ledger API v2 is served by the participant itself — no `http-json`
sidecar.

## 0. Prepare the host

```bash
# 2 vCPU / 4 GB RAM minimum; 20 GB disk
sudo apt update && sudo apt install -y docker.io docker-compose-v2
# Point an A record at the box: json.example.com → <VM IP>
```

## 1. Copy assets

```bash
scp -r docs/canton-deploy/assets root@<host>:/opt/nhs-canton
ssh root@<host>
cd /opt/nhs-canton
```

## 2. Configure secrets

Create `/opt/nhs-canton/.env`:

```env
POSTGRES_PASSWORD=<long random>
CANTON_AUTH_SECRET=<long random — same value you'll use to sign JWTs>
PUBLIC_HOSTNAME=json.example.com
ACME_EMAIL=ops@example.com
```

## 3. Boot

```bash
docker compose --profile prod up -d
docker compose ps
docker compose logs -f canton    # wait for "Canton ... started"
```

Compose brings up:

- `postgres` — participant + index DB (volume `pgdata`)
- `canton` — Canton 3.4 participant on internal `:5011`, **built-in** JSON
  Ledger API v2 on internal `:7575`
- `caddy` — TLS terminator on `:80` / `:443`, proxies to `canton:7575`

## 4. Sanity check

```bash
curl https://json.example.com/v2/state/ledger-end \
  -H "Authorization: Bearer $JWT"
# → {"offset":"..."}
```

## 5. Upload the DAR + parties

From your laptop (or the host) — see `05-upload-dar.md`. The two supported
paths in Canton 3 are:

1. `POST /v2/dars` and `POST /v2/parties` against the JSON API.
2. `docker compose exec canton bin/canton-console` and use
   `participant.dars.upload(...)` / `participant.parties.enable(...)`.

`daml ledger upload-dar` / `daml ledger allocate-parties` are removed.

## 6. Wire Lovable

Same as LocalNet: paste `https://json.example.com`, the JWT, the user id, and
the three party IDs into Project Settings → Secrets.

## Operations

- **Backups**: snapshot the `pgdata` volume daily. Canton's state of record is
  Postgres + the synchronizer.
- **Upgrades**: bump image tags in `docker-compose.yml`, run
  `docker compose pull && docker compose up -d`. Canton tolerates minor
  version skew within a major; read release notes for breaking changes.
- **Logs**: `docker compose logs --since 1h canton`.
- **Auth secret rotation**: change `CANTON_AUTH_SECRET` in `.env`,
  `docker compose up -d canton`, reissue JWTs, update the Lovable secret.

## Hardening checklist

- Close `:5011` and `:5012` on the host firewall — only Caddy → `:7575` is
  public.
- Switch JWT auth to `jwt-rs-256-crt` or `jwt-jwks` (see `04-jwt.md`) so the
  participant never holds the signing key.
- Enable Postgres backups (managed service or `pgbackrest`).
- Pin all image digests, not just tags, for reproducibility.
