# JSON Ledger API v2 — exact request shapes

Canton 3.x JSON Ledger API v2 has subtly different payload shapes from the v1 `http-json` sidecar. Don't guess from analogy. The exact shapes below are what works against Canton 3.4.

Base URL = your participant's public HTTPS URL (e.g. `https://nhs-canton-abc.fly.dev`). All endpoints require `Authorization: Bearer <JWT>`.

## DAR upload

```
POST /v2/dars
Content-Type: application/octet-stream
Authorization: Bearer <admin JWT>
Body: <raw .dar bytes>
```

- `200` = uploaded.
- `409` = already present at the same hash. Treat as success.
- The DAR is in the participant's package store after this; you do NOT need a separate "vet" step in 3.x.

## Allocate a party

```
POST /v2/parties
Content-Type: application/json
Authorization: Bearer <admin JWT>
Body: { "partyIdHint": "DHSC" }
```

Returns:
```json
{ "partyDetails": { "party": "DHSC::1220c1b682c17dc8...", "isLocal": true, ... } }
```

The returned `party` is the fully-qualified id — store it. Re-allocating with the same hint returns `409` (or `400` depending on Canton version) — fall back to `GET /v2/parties` and search by `party.startsWith("DHSC::")`.

`partyIdHint` regex: `^[A-Za-z0-9_-]{1,64}$`. Validate before sending.

## Create a ledger user

```
POST /v2/users
Content-Type: application/json
Authorization: Bearer <admin JWT>
Body:
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

**All five fields are required.** Missing any of `isDeactivated`, `metadata`, or `identityProviderId` returns `400 Invalid value for: body (Missing required field at '...')`.

`409` = user already exists. Treat as success.

## Grant rights to a user

```
POST /v2/users/{userId}/rights
Content-Type: application/json
Authorization: Bearer <admin JWT>
Body:
{
  "userId": "lovable-nhs-app",
  "identityProviderId": "",
  "rights": [
    { "kind": { "CanActAs":  { "value": { "party": "DHSC::1220..." } } } },
    { "kind": { "CanActAs":  { "value": { "party": "Trust-GSTT::1220..." } } } },
    { "kind": { "CanReadAs": { "value": { "party": "Auditor::1220..." } } } }
  ]
}
```

The trap: rights items use a **doubly-nested** shape. NOT `{ kind: { CanActAs: { party } } }`. The exact path is `kind.<RightType>.value.party`.

- Top-level `userId` and `identityProviderId` are also required even though they duplicate the URL path. Without them you get `400 Invalid value for: body`.
- `404 USER_NOT_FOUND` = the user wasn't created on this participant (typical after destroying the machine the user was created on — re-run user creation).
- `404 UNKNOWN_RESOURCE: Provided parties have not been found` = those parties were allocated on a **different** participant. You're running multi-machine; see `fly-single-machine.md`.

## Submit a command

There are two submission endpoints. **Pick by what you need back.**

### `POST /v2/commands/submit-and-wait` — fire & confirm only

Returns `{ updateId, completionOffset }`. No transaction, no events. Use when you only need to know "did it commit". Body is **flat**:

```json
{
  "commands": [ { "CreateCommand": { "templateId": "...", "createArguments": { } } } ],
  "userId": "lovable-nhs-app",
  "commandId": "alloc-...",
  "actAs": ["DHSC::1220..."],
  "readAs": []
}
```

### `POST /v2/commands/submit-and-wait-for-transaction` — get the contract back

Returns the full transaction including `events[]` with the `CreatedEvent` for each new contract id. Use this whenever the caller needs the contract id of what it just created. Body is **wrapped under `commands`**:

```json
{
  "commands": {
    "commands": [ { "CreateCommand": { } } ],
    "userId": "lovable-nhs-app",
    "commandId": "alloc-...",
    "actAs": ["DHSC::1220..."],
    "readAs": []
  }
}
```

Sending the flat shape to this endpoint returns:
`400 Invalid value for: body (Missing required field at 'commands.commands', Missing required field at 'commands.commandId', Missing required field at 'commands.actAs')`.

Sending the wrapped shape to `submit-and-wait` is fine syntactically but the response still won't contain events — that endpoint never returns a transaction. Reading `response.transaction.events` off it produces `Canton: no CreatedEvent in transaction`.

## Health / readiness

```
GET /v2/state/ledger-end
```

- No auth → `401` (server is up and enforcing auth).
- Admin JWT → `200 { offset: "..." }`.

Use it for both Fly health checks and post-deploy waits.

## Error shape

Most v2 errors look like:

```json
{
  "code": "USER_NOT_FOUND",
  "cause": "...",
  "correlationId": null,
  "traceId": "...",
  "context": { "participant": "'participant1'", "...": "..." },
  "resources": [["ErrorResource(USER)", "lovable-nhs-app"]]
}
```

Log `code`, `cause`, and `resources` — they tell you exactly what to fix. The `context.participant` field is invaluable for detecting multi-machine drift.
