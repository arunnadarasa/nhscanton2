# Seaport / Canton Network Devnet

Managed Canton Devnet validator (e.g. Seaport's 5N Sandbox). Collapses self-hosting down to "configure six secrets and run `/deploy`". OIDC `client_credentials` against an external IdP (Authentik in Seaport's case) replaces locally-minted RS256 JWTs. Everything else — JSON Ledger API v2 calls, party allocation, rights — is identical to Fly.

## Required secrets

| Secret | What it is |
| --- | --- |
| `CANTON_DEVNET_JSON_API_URL` | Base URL of the Seaport validator (no trailing slash). |
| `CANTON_DEVNET_OIDC_TOKEN_URL` | IdP token endpoint (e.g. Authentik `/application/o/token/`). |
| `CANTON_DEVNET_OIDC_AUDIENCE` | `aud` claim the validator expects on both tokens. |
| `CANTON_DEVNET_OIDC_SCOPE` | Usually `openid profile` plus any IdP-specific scope. |
| `CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID` / `_SECRET` | Runtime user — used for all `liveQuery` / `liveCreate` / command submission. |
| `CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID` / `_SECRET` | Admin — DAR upload, party allocation, user mgmt. (Some sponsors give you one client and the same client doubles for both roles. Try that first.) |
| `DEPLOY_ADMIN_TOKEN` | Shared secret guarding `/api/public/admin/*` server routes. Generate with `openssl rand -hex 32`. |

## Token minting

```ts
// src/lib/canton/oidc.server.ts
async function mintDevnetToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    audience: process.env.CANTON_DEVNET_OIDC_AUDIENCE!,
    scope: process.env.CANTON_DEVNET_OIDC_SCOPE!,
  });
  const res = await fetch(process.env.CANTON_DEVNET_OIDC_TOKEN_URL!, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`oidc token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}
```

Cache per-client-id with a 30s safety margin under the IdP-advertised `expires_in`.

## CRITICAL: `userId` MUST equal the runtime token's `sub`

The validator enforces this. Hardcoding `userId: "lovable-nhs-app"` returns a **`403 security-sensitive error`** with no detail (deliberately — leaking the expected id would itself be a leak).

```ts
import { decodeJwt } from "jose";

export async function getRuntimeLedgerUserId(): Promise<string> {
  const token = await getRuntimeToken();
  const { sub } = decodeJwt(token);
  if (!sub) throw new Error("runtime token has no `sub` claim");
  return sub; // e.g. "6" or a UUID — opaque, don't try to format it
}
```

Use this everywhere:
- As the `userId` in `POST /v2/commands/submit-and-wait-for-transaction`.
- As the `{id}` in `POST /v2/users/{id}/rights` when granting party rights.
- As the user you upsert via `POST /v2/users` (idempotent — 409 is fine).

## Paginated party resolution

Devnet's `/v2/parties` returns 10k+ parties — a single unpaged call frequently 502s through Cloudflare. Page and build a local map once per bootstrap:

```ts
async function listAllParties(adminToken: string): Promise<PartyDetails[]> {
  const out: PartyDetails[] = [];
  let pageToken = "";
  while (true) {
    const url = new URL("/v2/parties", JSON_API);
    url.searchParams.set("pageSize", "2000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { authorization: `Bearer ${adminToken}` } });
    const json = await res.json();
    out.push(...(json.partyDetails ?? []));
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return out;
}
```

Then resolve a logical hint by `parties.find(p => p.party.startsWith(`${hint}::`))`.

## Per-request network override (cookie)

A single published site often needs to target both Fly and Devnet from different admin endpoints. Don't flip `CANTON_MODE` globally — read a cookie per-request:

```ts
export function selectNetwork(request: Request): "fly" | "seaport" {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/canton_network=([^;]+)/);
  return (match?.[1] as any) ?? (process.env.CANTON_MODE as any) ?? "fly";
}
```

Then `curl` targets whichever network you want without redeploying:

```bash
curl -X POST https://nhscanton2.lovable.app/api/public/admin/self-deploy \
  -H "x-deploy-token: $DEPLOY_ADMIN_TOKEN" \
  -H "Cookie: canton_network=seaport" \
  -H "content-type: application/json" -d '{}'
```

## Shared runtime user hits `TOO_MANY_USER_RIGHTS`

On Seaport, the OIDC runtime client is often shared across every tenant of a sponsor (the JWT `sub` is a small integer like `"6"`, primary party `5nsandbox-devnet-2::…`, annotation `otc-canton-fund-oauth`). Canton caps user rights at 1000, and each tenant's deploys pile on. Once you hit the cap, `POST /v2/users/{id}/rights` returns:

```json
{ "code": "TOO_MANY_USER_RIGHTS", "cause": "grant user rights failed, as user \"6\" would have too many rights." }
```

Symptom in-app: step N-1 works (its rights were granted before the cap), step N returns the opaque `403 security-sensitive` because the missing party's `CanActAs` never landed.

Bootstrap must be surgical on a shared user:

1. **List existing rights** and only POST what's missing.
2. **Revoke stale rights** for your own hint namespace (party hint matches, fingerprint doesn't) via `PATCH /v2/users/{id}/rights` — the actual JSON API 3.4 endpoint. `POST /rights/revoke` returns 404 on the current validator.
3. **Grant only `CanActAs`.** `CanActAs` subsumes `CanReadAs` in Daml semantics, so granting both doubles your footprint on the shared user for zero benefit. Revoke any redundant `CanReadAs` you find on your current fingerprint.
4. **Never touch other tenants' rights** — the guard is "party hint prefix ∈ our known hint set".
5. **`DELETE /v2/users/{id}`** doesn't help — the request errors `Requesting user cannot delete itself`.

Verify with `missingActAs` only, not `missingReadAs`.

## Mock-USDCx mint pattern

For demos that need fungible balances without going through real xReserve USDCx:



For demos that need fungible balances without going through real xReserve USDCx:

1. Upload a tiny `mock-usdcx` DAR (Holding template: `issuer` signatory, `owner` signatory, `amount: Decimal`) after the main app DAR.
2. **Grant `CanActAs` on the issuer party** to the runtime user. This is the most common gotcha — if you treat your `Auditor` party as observer-only (read-only rights), `mint` commands return the opaque `403 security-sensitive error`.
3. Submit `CreateCommand`s with `templateId: "#mock-usdcx:MockUsdcx:Holding"`. The `#<package-name>` form resolves to the latest uploaded version — no need to pin a `CANTON_USDCX_PACKAGE_ID` secret for demo DARs.

For real Circle xReserve USDCx on Devnet, pin a specific package id via env and skip the mint (you'd be calling a `Transfer` choice instead).

## Diff vs Fly.io path

| | Fly.io | Seaport Devnet |
| --- | --- | --- |
| Admin token subject | `sub: "participant_admin"` (RS256) | bootstrap OIDC client |
| Runtime user id | You choose (e.g. `lovable-nhs-app`) | Token `sub` (e.g. `"6"`) |
| Ledger `userId` in commands | Same as the user you created | Same as runtime token `sub` |
| Number of parties listed | The ones you allocated | 10k+ shared with the network |
| Synchronizer | Embedded | Devnet global |
| Where infra failures happen | Fly machines, volume | None — sponsor runs the validator |

## Status of the Fly.io path

Not deleted, just not the default. See `references/fly-single-machine.md` + `references/jwt-auth.md` for the self-host path. The bootstrap pipeline (`references/bootstrap-flow.md`) and v2 API contract (`references/json-ledger-api-v2.md`) are shared — only token minting differs.
