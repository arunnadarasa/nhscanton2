# 05 — Build, upload DAR, allocate parties (Canton 3.x)

Once the participant is up and you can mint admin JWTs, ship the model.

> Canton 3.x: the `daml` Assistant is deprecated in 3.4 and removed in 3.5.
> Use `dpm build` to compile, and either the **JSON Ledger API v2** or the
> **Canton Console** to upload + allocate.

## 1. Build the DAR

From the repo root:

```bash
cd daml
dpm build
# → .daml/dist/nhs-budget-0.1.0.dar
```

Output name is determined by `name` + `version` in `daml/daml.yaml`.

## 2. Upload to the participant

### Option A — JSON Ledger API v2 (preferred)

```bash
curl -X POST "$CANTON_JSON_API_URL/v2/dars" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  --data-binary @.daml/dist/nhs-budget-0.1.0.dar \
  -H "Content-Type: application/octet-stream"
```

### Option B — Canton Console

```bash
docker compose exec canton bin/canton-console
@ participant.dars.upload("/opt/dars/nhs-budget-0.1.0.dar")
```

On Fly: `flyctl ssh console -a nhs-canton-participant`, then run the same.

## 3. Allocate parties

The app expects these party hints (the actual IDs include a fingerprint
suffix like `::1220abcd...`):

| Party hint | Maps to Lovable secret |
| --- | --- |
| `DHSC` | `CANTON_PARTY_DHSC` |
| `NHSEngland` | `CANTON_PARTY_NHSE` |
| `Auditor` | `CANTON_PARTY_AUDITOR` |
| `ICB-<code>` (e.g. `ICB-QOQ`) | used as-is from app payloads |
| `Trust-<code>` (e.g. `Trust-RJ1`) | used as-is from app payloads |

### Option A — JSON Ledger API v2

```bash
for hint in DHSC NHSEngland Auditor ICB-QOQ Trust-RJ1; do
  curl -X POST "$CANTON_JSON_API_URL/v2/parties" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    -H "Content-Type: application/json" \
    -d "{\"partyIdHint\":\"$hint\"}"
done
```

Each response contains the fully-qualified `partyDetails.party`. Copy
`DHSC::...`, `NHSEngland::...`, and `Auditor::...` into the matching Lovable
secrets.

### Option B — Canton Console

```scala
@ participant.parties.enable("DHSC")
@ participant.parties.enable("NHSEngland")
@ participant.parties.enable("Auditor")
@ List("QOQ","QF7","QH8").foreach(c => participant.parties.enable(s"ICB-$c"))
@ List("RJ1","RXH","RWE").foreach(c => participant.parties.enable(s"Trust-$c"))
@ participant.parties.list().foreach(p => println(p.party))
```

## 4. Create the ledger user + grant rights

The runtime JWT's `sub` claim identifies a **ledger user** whose rights
control which parties it can submit for.

```bash
curl -X POST "$CANTON_JSON_API_URL/v2/users" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "user": { "id": "lovable-nhs-app", "primaryParty": "" } }'

curl -X POST "$CANTON_JSON_API_URL/v2/users/lovable-nhs-app/rights" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "rights": [
          { "kind": { "CanActAs":  { "party": "'"$DHSC"'" } } },
          { "kind": { "CanActAs":  { "party": "'"$NHSE"'" } } },
          { "kind": { "CanReadAs": { "party": "'"$AUDITOR"'" } } }
        ] }'
```

## 5. Reissue the runtime JWT

Mint a non-admin runtime token bound to the user (no `--admin` flag), and
update `CANTON_JWT` in Lovable Project Settings.

## 6. Verify

```bash
curl "$CANTON_JSON_API_URL/v2/state/ledger-end" \
  -H "Authorization: Bearer $CANTON_JWT"
# → {"offset":"..."}

curl https://<your-lovable-preview>/api/public/health
# → { "ledger": { "mode": "live", "endpoint": "..." }, "liveCheck": { "ok": true, "offset": "..." } }
```

From the app, create an allocation on `/allocations` — it should land on the
real ledger and show up in `POST /v2/state/active-contracts`.

## Re-uploading after model changes

DARs are immutable but additive. After editing `daml/Nhs.daml`:

1. Bump `version` in `daml/daml.yaml` (e.g. `0.1.0` → `0.1.1`).
2. `dpm build && curl -X POST .../v2/dars ...` again.
3. Existing contracts created with the old version remain queryable; new
   commands use the latest.
