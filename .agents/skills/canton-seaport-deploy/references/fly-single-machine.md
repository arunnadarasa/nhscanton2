# Single-machine Fly deployment for Canton

Canton participants are stateful. They own a sqlite/postgres data dir, an in-memory party allocation table, and a participant fingerprint that's part of every party ID (`Name::<fingerprint>`). **You cannot run more than one machine.**

## Symptoms of multi-machine deploys

- Bootstrap returns party IDs with two distinct fingerprints in the same response (e.g. some `DHSC::1220c1b6…`, others `Trust-GSTT::12204021…`).
- `POST /v2/users/{id}/rights` returns `UNKNOWN_RESOURCE: Provided parties have not been found` for half the parties.
- User created on one bootstrap run vanishes on the next (`USER_NOT_FOUND`).
- Logs show two different `participant=` ids across requests.

## Fly toml — the canonical block

```toml
app = "your-canton-app"
primary_region = "lhr"

[build]
  dockerfile = "Dockerfile"

[env]
  JAVA_OPTS = "-Xms512m -Xmx1500m"

[[mounts]]
  source = "canton_data"
  destination = "/canton/data"

# Canton participants are stateful — exactly ONE machine.
[http_service]
  internal_port = 7575
  force_https = true
  auto_stop_machines = false
  auto_start_machines = false
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus     = 2
  memory_mb = 4096      # Canton needs ≥3 GB headroom; 4 GB is the safe floor
```

`auto_stop_machines = false` prevents Fly from cold-starting a second machine on burst. `min_machines_running = 1` keeps the single one warm.

## After deploy: enforce count = 1

`flyctl deploy` can leave behind a second machine if one already existed. Always follow up with:

```bash
flyctl scale count 1 -a "$APP_NAME" --yes
```

If two machines already exist with diverged state, pick whichever has the most contracts/data and destroy the other:

```bash
flyctl machines list -a "$APP_NAME"
flyctl machines destroy <other-id> -a "$APP_NAME" --force
```

Then re-run the bootstrap — it's idempotent and will re-allocate any missing parties on the survivor.

## Memory and CPU

- **2 GB is too small.** Canton OOMs during startup. Use 4 GB minimum.
- `JAVA_OPTS=-Xms512m -Xmx1500m` leaves headroom for the JVM's native + GC overhead within 2 GB containers; bump `-Xmx` to ~3000m if you raise the container to 4 GB.
- 2 shared CPUs is enough for demo workloads. Don't over-provision.

## Health check

`/v2/state/ledger-end`:
- `401` with no auth header → ready (auth is enforced)
- `200` with a valid admin JWT → ready and serving
- `503` / connection refused → still booting (allow ~60s)

Use a polling loop with `curl -o /dev/null -w "%{http_code}"`; treat `401` or `200` as success.

## When you legitimately need horizontal scale

You don't. For higher throughput, vertically scale (more CPU/memory). For HA, run a second Canton **domain** or use Canton's built-in replication — not Fly's machine count.
