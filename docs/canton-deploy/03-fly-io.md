# 03 — Fly.io

Managed Canton 3.4 deployment with built-in HTTPS and a managed Postgres.
Cheapest always-on option that doesn't require you to babysit a VM.

In Canton 3 the JSON Ledger API v2 lives **inside** the participant, so this
is now a single Fly app (no separate `http-json` / Caddy app).

Cost estimate (eu-west region, 2026): ~$15 participant + ~$5 Postgres =
**~$20/mo** at the smallest sizes.

## 1. Install + login

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
```

## 2. Create the Postgres cluster

```bash
flyctl postgres create \
  --name nhs-canton-db \
  --region lhr \
  --vm-size shared-cpu-1x \
  --volume-size 10
# Save the connection string it prints.
```

## 3. Deploy the participant (public JSON API v2, private gRPC)

```bash
cd docs/canton-deploy/assets/fly
# Stage your DAR next to the Dockerfile so it gets baked in:
mkdir -p dars && cp ../../../../daml/.daml/dist/nhs-budget-0.1.0.dar dars/
cp participant.fly.toml fly.toml
flyctl launch --no-deploy --name nhs-canton-participant --region lhr --copy-config
flyctl volumes create canton_data --region lhr --size 5
flyctl secrets set \
  POSTGRES_PASSWORD='<from step 2>' \
  CANTON_AUTH_SECRET='<long random>'
flyctl deploy
flyctl scale count 1 -a nhs-canton-participant --yes   # Canton is stateful — pin to 1 machine
```

`participant.fly.toml` exposes port `7575` publicly behind Fly's TLS edge.
The gRPC ledger-api on `:5011` stays on Fly's private IPv6 mesh
(`*.internal`).

Your public URL is now `https://nhs-canton-participant.fly.dev` (or attach a
custom domain via `flyctl certs add`).

## 4. Bootstrap the ledger (DAR + parties + user + rights)

**Preferred — one call from the app.** Once the Lovable secrets in step 5
are set, the app exposes a token-gated bootstrap route that uploads the DAR,
allocates every party, creates the runtime user, grants `CanReadAs` on every
party + `CanActAs` on every non-auditor, and verifies the result:

```bash
curl -X POST https://<your-lovable-app>/api/public/admin/deploy \
  -H "x-deploy-token: $DEPLOY_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Or trigger it from the `/deploy` page in the app (it calls the sibling
`/api/public/admin/self-deploy` route, which reads the token server-side so
you never paste it into a browser). Both routes are idempotent — re-run them
after any redeploy, fingerprint change, or machine destroy.

The response includes `verify` (runtime-user auth probe) and `rightsVerify`
(rights diff). If either is non-ok, see the `canton-fly-deploy` skill's
`debugging-checklist.md`.

**Manual fallback** — useful only if the app isn't reachable yet:

```bash
flyctl ssh console -a nhs-canton-participant
# inside the machine:
bin/canton-console
@ participant.parties.enable("DHSC")
@ participant.parties.enable("NHSEngland")
@ participant.parties.enable("Auditor")
```

Or hit `POST /v2/parties` from your laptop — full script in
`05-upload-dar.md`.

## 5. Wire Lovable

In **Project Settings → Secrets**:

- `CANTON_JSON_API_URL` = `https://nhs-canton-participant.fly.dev`
- `CANTON_JWT_PRIVATE_KEY` = RS256 private key (PEM or base64-encoded PEM)
  whose matching public cert is baked into `canton.conf`. The app mints
  short-lived (5 min) admin and runtime tokens locally — there is no
  long-lived `CANTON_JWT` secret anymore.
- `CANTON_USER_ID` = ledger user id used as the runtime JWT `sub`
  (default `lovable-nhs-app`; must match the user created in step 4).
- `DEPLOY_ADMIN_TOKEN` = shared secret gating `/api/public/admin/deploy`.
  Generate with `openssl rand -hex 32`.

## Operations

- **Logs**: `flyctl logs -a nhs-canton-participant`
- **Scale**: participants are stateful — keep at `count = 1`. If you need
  more JSON API throughput, front Fly with Cloudflare instead of scaling
  the participant.
- **Backups**: Fly Postgres takes daily snapshots; verify in the dashboard.
- **Upgrades**: bump the `FROM ...canton-participant:<tag>` line in
  `Dockerfile`, `flyctl deploy`. Single-machine rollout = short downtime —
  acceptable for a hackathon-grade demo.

## Going further

- Connect to the Canton **Global Synchronizer** instead of running an
  embedded one — replace `canton.conf` with a participant-only config and
  point `sequencer-connection` at the synchronizer endpoint. See
  <https://docs.digitalasset.com/operate/3.4/>.
- Front the participant with Cloudflare for DDoS protection.
