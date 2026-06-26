# Bootstrap flow

A single idempotent server route that, given a freshly-deployed (or shared Devnet) Canton participant, makes the app usable end-to-end. Token-gated with a shared secret so it's replayable but not public.

## Pipeline

```text
                +-------------------------+
caller -------> | x-deploy-token check    |
                +------------+------------+
                             |
                             v
                +-------------------------+
                | 1. mint admin token     |  RS256 (Fly) OR OIDC client_credentials (Devnet)
                +------------+------------+
                             v
                +-------------------------+
                | 2. POST /v2/dars        |  bytes; 200 or 409 = ok. Upload main + feeder DARs.
                |    (re-upload always)   |  Don't skip — see dar-lifecycle.md
                +------------+------------+
                             v
                +-------------------------+
                | 3. allocate each party  |  POST /v2/parties per hint
                |    + resolve existing   |  paged GET /v2/parties on Devnet (10k+)
                +------------+------------+
                             v
                +-------------------------+
                | 3b. persist mapping     |  upsert into backend table
                +------------+------------+
                             v
                +-------------------------+
                | 4. upsert runtime user  |  Fly: id you chose. Devnet: id = runtime token `sub`.
                +------------+------------+
                             v
                +-------------------------+
                | 5. POST /v2/users/{id}  |  CanActAs + CanReadAs on EVERY party
                |    /rights              |  (no observer-only exception — see Lesson A)
                +-------------------------+
```

## Step 1 — admin token

| Network | How |
| --- | --- |
| Fly | Sign RS256 JWT with `sub: "participant_admin"`, `participantAdmin: true`. See `jwt-auth.md`. |
| Devnet | `POST` to `CANTON_DEVNET_OIDC_TOKEN_URL` with `grant_type=client_credentials` and the bootstrap client creds. See `seaport-devnet.md`. |

## Step 2 — DAR upload (always re-upload)

```ts
for (const path of ["/dars/nhs-budget-app-v2-1.0.1.dar.bin", "/dars/mock-usdcx-1.0.0.dar.bin"]) {
  const dar = await fetch(new URL(path, origin)).then(r => r.arrayBuffer());
  const res = await fetch(`${JSON_API}/v2/dars`, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/octet-stream" },
    body: dar,
  });
  results.push({ step: `upload:${path}`, status: res.status, body: (await res.text()).slice(0, 500) });
}
```

200 = uploaded fresh; 409 = same hash already present. Both are success. See `dar-lifecycle.md` for why you must re-upload on every deploy and why you can't serve `.dar` (use `.dar.bin`).

## Step 3 — party allocation (idempotent)

On Fly, just `POST /v2/parties { partyIdHint }` per hint; on 409, search `/v2/parties` for `party.startsWith(hint + "::")`.

On Devnet, `/v2/parties` returns 10k+ parties shared with the network. Page once up-front, build a `Map<hint, partyId>`, allocate only the hints not found:

```ts
const existing = await listAllParties(adminToken);          // paged, pageSize=2000
const map = new Map<string, string>();
for (const hint of HINTS) {
  const found = existing.find(p => p.party.startsWith(`${hint}::`));
  if (found) { map.set(hint, found.party); continue; }
  const res = await fetch(`${JSON_API}/v2/parties`, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ partyIdHint: hint, identityProviderId: "" }),
  });
  const j = await res.json();
  map.set(hint, j.partyDetails.party);
}
```

## Step 3b — persist the mapping

Logical hints (`"DHSC"`, `"Trust-GSTT"`) appear throughout app code. Fully-qualified ids (`"DHSC::1220..."`) are required by the ledger API. Keep a server-only mapping:

```sql
CREATE TABLE public.canton_parties (
  logical_name text PRIMARY KEY,
  party_id     text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.canton_parties TO service_role;
ALTER TABLE public.canton_parties ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role can read or write.
```

Server-only resolver, cached per isolate:

```ts
export async function resolveParty(hint: string): Promise<string> {
  if (hint.includes("::")) return hint;
  const map = await loadMap();
  const id = map.get(hint);
  if (!id) throw new Error(`party "${hint}" not allocated — run /api/public/admin/deploy`);
  return id;
}
```

## Step 4 — runtime user (upsert)

```ts
const userId = network === "seaport"
  ? await getRuntimeLedgerUserId()    // decode runtime token, return `sub`
  : "lovable-nhs-app";                // Fly: you choose

await fetch(`${JSON_API}/v2/users`, {
  method: "POST",
  headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
  body: JSON.stringify({
    user: {
      id: userId,
      primaryParty: "",
      isDeactivated: false,
      metadata: { resourceVersion: "", annotations: {} },
      identityProviderId: "",
    },
  }),
});
// 200 = created, 409 = already exists. Both fine.
```

On Devnet, omitting `getRuntimeLedgerUserId()` and hardcoding a name is the most common cause of the opaque `403 security-sensitive error` later. See `seaport-devnet.md`.

## Step 5 — rights (CanActAs + CanReadAs on every party)

```ts
const rights = [...map.values()].flatMap(party => [
  { kind: { CanActAs:  { value: { party } } } },
  { kind: { CanReadAs: { value: { party } } } },
]);

await fetch(`${JSON_API}/v2/users/${userId}/rights`, {
  method: "POST",
  headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
  body: JSON.stringify({ userId, identityProviderId: "", rights }),
});
```

**No "observer-only" exceptions.** Granting only `CanReadAs` to a party that ends up as a signatory on any uploaded template (e.g. Auditor as `mock-usdcx` issuer) returns a 403 with no body at command-submission time. Cost: ~10 min if you read the response, much longer if you assume it's a token issue.

## Idempotency rules

- Step 2: 409 → same-hash DAR already there. Success.
- Step 3: 409 or "already exists" → `GET /v2/parties` and find by `startsWith(hint + "::")`. Persist that.
- Step 4: 409 → user exists. Skip and continue to step 5.
- Step 5: re-granting the same right is fine — Canton returns `newlyGrantedRights: []`.

## Always return full bodies on failure

```ts
const r = await fetch(url, { ... });
const body = await r.text();
results.push({ step: "create-user", status: r.status, ok: r.ok, body: body.slice(0, 500) });
```

The exact `cause` strings from Canton tell you which field is missing, which party doesn't exist, or which participant served the request.

## Self-deploy convenience

For one-shot bootstrap from the UI or `stack_modern--invoke-server-function`, ship a `/api/public/admin/self-deploy` route that reads `DEPLOY_ADMIN_TOKEN` server-side, forwards the incoming `Cookie` header (so per-request `canton_network=…` overrides work), and proxies to `/api/public/admin/deploy`. Token never reaches the client.

## When to re-run

- After every code change to the bootstrap pipeline.
- After uploading a new DAR (new templates → new signatories → new rights needed).
- After destroying a Fly machine.
- On `UNKNOWN_RESOURCE`, `USER_NOT_FOUND`, or unexpected fingerprint changes.
- When you add new parties to the app's domain model.
