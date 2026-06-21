# 04 — JWT auth (Canton 3.x)

Canton 3's Ledger API authenticates every gRPC/JSON call with a JWT. Unlike
Daml 2.x, the token does **not** carry `actAs`/`readAs` or the
`https://daml.com/ledger-api` namespaced claim — `actAs`/`readAs` are granted
server-side via the Users API and tied to the `sub` (ledger user id).

## Audience-based token (preferred)

```json
{
  "sub": "lovable-nhs-app",
  "aud": "https://daml.com/jwt/aud/participant/nhs-participant-1",
  "iat": 1781250000,
  "exp": 1788940000
}
```

- `aud` must match `target-audience` on the participant's `ledger-api`
  `auth-services` entry.
- `sub` is the **ledger user id**. Its rights (`CanActAs`, `CanReadAs`,
  `IdentityProviderAdmin`) determine which parties the caller can use.

## Scope-based token (alternative)

```json
{
  "sub": "lovable-nhs-app",
  "aud": "nhs-participant-1",
  "scope": "daml_ledger_api",
  "iat": 1781250000,
  "exp": 1788940000
}
```

Use whichever style your `canton.conf` is configured for.

## Granting party rights to the ledger user

After allocating parties (`05-upload-dar.md`), grant the runtime user the
right to act/read as them:

```bash
curl -X POST "$CANTON_JSON_API_URL/v2/users/lovable-nhs-app/rights" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "rights": [
      { "kind": { "CanActAs":  { "party": "'"$DHSC"'" } } },
      { "kind": { "CanActAs":  { "party": "'"$NHSE"'" } } },
      { "kind": { "CanReadAs": { "party": "'"$AUDITOR"'" } } }
    ]
  }'
```

## Dev: HS256 (shared secret)

For LocalNet and Docker, the participant is configured (in `canton.conf`) to
accept JWTs signed with `CANTON_AUTH_SECRET` using HS256 via
`unsafe-jwt-hmac-256`.

Mint one with the bundled script:

```bash
cd docs/canton-deploy/assets/jwt
export CANTON_AUTH_SECRET='<same value as in .env>'
bun run issue-dev-token.ts \
  --participant nhs-participant-1 \
  --user lovable-nhs-app \
  --ttl 7776000   # 90 days
```

Add `--admin` for the DAR-upload / party-allocation JWT (adds
`scope: "daml_ledger_api admin"`).

> `unsafe-jwt-hmac-256` is explicitly flagged dev-only in the Canton docs.
> Do not reuse the dev secret for production.

## Prod: RS256 + JWKS

For anything internet-facing, switch the participant to verify tokens via a
JWKS URL:

```hocon
# canton.conf (excerpt) — Canton 3.4
canton.participants.participant.ledger-api.auth-services = [
  {
    type = jwt-jwks
    url  = "https://auth.example.com/.well-known/jwks.json"
    target-audience = "https://daml.com/jwt/aud/participant/nhs-participant-1"
  }
]
```

Other supported types: `jwt-rs-256-crt`, `jwt-es-256-crt`, `jwt-es-512-crt`.

Recommended provider setups:

- **Auth0** / **Keycloak**: emit audience-based tokens with `sub = <ledger user>`
  and the audience above. Grant party rights once via the Users API.
- **Self-hosted**: a tiny service (e.g. another `createServerFn`) that signs
  short-lived JWTs after authenticating the caller.

## Rotating the Lovable JWT

When the token nears `exp`:

1. Mint a new token (HS256 script or your OIDC provider).
2. In Lovable, open **Project Settings → Secrets**, edit `CANTON_JWT`, paste
   the new value, save.
3. Server functions on the next request pick up the new env var — no redeploy
   needed.

## Common errors

| Symptom | Cause |
| --- | --- |
| `401 Could not verify token` | Wrong signing key or `aud` mismatch with `target-audience` |
| `PERMISSION_DENIED actAs party X` | Ledger user `sub` has no `CanActAs` right for that party — call `POST /v2/users/{userId}/rights` |
| `PERMISSION_DENIED admin required` | Used the runtime token for an admin call (DAR upload, party allocation) |
| `Token expired` | `exp` passed — mint a new one and update the secret |
