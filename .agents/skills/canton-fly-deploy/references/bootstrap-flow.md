# Bootstrap flow

A single idempotent server route that, given a freshly-deployed Canton participant, makes the app usable end-to-end. Token-gated with a shared secret so it's replayable but not public.

## Pipeline

```
text
                +-------------------------+
caller -------> | x-deploy-token check    |
                +------------+------------+
                             |
                             v
                +-------------------------+
                | 1. mint admin JWT       |  RS256, sub=participant_admin
                +------------+------------+
                             v
                +-------------------------+
                | 2. POST /v2/dars        |  bytes; 200 or 409 = ok
                +------------+------------+
                             v
                +-------------------------+
                | 3. allocate each party  |  POST /v2/parties per hint
                |    (idempotent)         |  capture {hint, partyId}
                +------------+------------+
                             v
                +-------------------------+
                | 3b. persist mapping     |  upsert into backend table
                +------------+------------+
                             v
                +-------------------------+
                | 4. POST /v2/users       |  full user object; 200/409 = ok
                +------------+------------+
                             v
                +-------------------------+
                | 5. POST /v2/users/{id}  |  rights array with nested .value
                |    /rights              |
                +-------------------------+
```

## Idempotency rules

- Step 2: 409 means same-hash DAR already there. Success.
- Step 3: 409 (or 400 with "already exists") → `GET /v2/parties` and find by `party.startsWith(hint + "::")`. Persist that.
- Step 4: 409 → user exists. Skip and continue to step 5.
- Step 5: re-granting the same right is fine — Canton returns `newlyGrantedRights: []` if there's nothing new.

## Persisting the party map

Logical hints (`"DHSC"`, `"Trust-GSTT"`) appear throughout app code. Fully-qualified ids (`"DHSC::1220..."`) are required by the ledger API. Keep a server-only mapping:

```sql
CREATE TABLE public.canton_parties (
  logical_name text PRIMARY KEY,
  party_id     text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.canton_parties TO service_role;
ALTER TABLE public.canton_parties ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role (server fns / bootstrap route) can read or write.
```

Use a server-only resolver that caches the map per isolate and throws a friendly error if a hint hasn't been allocated yet:

```ts
export async function resolveParty(hint: string): Promise<string> {
  if (hint.includes("::")) return hint;             // already qualified
  const map = await loadMap();                       // cached
  const id = map.get(hint);
  if (!id) throw new Error(`party "${hint}" not allocated — run /api/public/admin/deploy`);
  return id;
}
```

## Always return full bodies on failure

Every step's response body is gold the first 3-4 times you run this. Don't summarise to a status code:

```ts
const r = await fetch(url, { ... });
const body = await r.text();
results.push({ step: "create-user", status: r.status, ok: r.ok, body: body.slice(0, 500) });
```

The exact `cause` strings from Canton tell you which field is missing, which party doesn't exist, or which participant served the request.

## When the user resists pasting the deploy token

For one-shot bootstrap-from-the-UI, ship a temporary `/api/public/admin/self-deploy` route that reads the token from `process.env.DEPLOY_ADMIN_TOKEN` server-side and proxies to `/api/public/admin/deploy`. Delete it after the live ledger is initialized. Never persist the deploy token in the client bundle.

## Re-running after a redeploy or machine destroy

The bootstrap is safe to re-run anytime. Specifically re-run it whenever:
- You destroy a Fly machine (a new one starts with empty state).
- You see `UNKNOWN_RESOURCE` or `USER_NOT_FOUND` from the ledger API.
- The participant fingerprint in `code/cause` changes between requests.
- You add new parties to the app's domain model.
