# Canton ledger auth

Every JSON Ledger API v2 request carries `Authorization: Bearer <JWT>`. The participant either trusts a public cert you control (Fly self-host → mint RS256 locally) or an external IdP (Seaport / Canton Network Devnet → `client_credentials` against Authentik or similar).

## Two subjects, two purposes — always

| Subject | Use for | Extra claims (Fly) |
| --- | --- | --- |
| Admin (`participant_admin` on Fly; bootstrap OIDC client on Devnet) | DAR upload, party allocation, user/rights mgmt — `/v2/parties`, `/v2/users`, `/v2/dars` | `participantAdmin: true` |
| Runtime user (you choose on Fly; runtime OIDC client on Devnet) | All ledger reads (`/v2/state/...`), command submission (`/v2/commands`), update streams | none |

**The admin/bootstrap token does NOT authorize ledger reads.** If you use it for `getActiveContracts`, you get `PERMISSION_DENIED`. Mint a separate runtime token whose subject has been granted `CanActAs` / `CanReadAs` on every relevant party.

## Path A — Fly self-host (RS256, locally minted)

### Claims

```ts
{
  sub:   "participant_admin"           // or "<runtime-user-id>"
  aud:   "canton-ledger-api"           // must match canton.conf
  scope: "daml_ledger_api daml_ledger_api.admin"
  participantAdmin: true               // ONLY on the admin token
  iat:   <now>
  exp:   <now + 300>                   // 5 min TTL; cache + re-mint
}
```

Header: `{ alg: "RS256", typ: "JWT" }`.

### Mint with jose

```ts
import { SignJWT, importPKCS8 } from "jose";

const key = await importPKCS8(process.env.CANTON_JWT_PRIVATE_KEY!, "RS256");

const token = await new SignJWT({
    scope: "daml_ledger_api daml_ledger_api.admin",
    participantAdmin: true,    // omit on runtime-user token
  })
  .setProtectedHeader({ alg: "RS256", typ: "JWT" })
  .setSubject("participant_admin")
  .setAudience("canton-ledger-api")
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(key);
```

Cache per-subject with a 30s safety margin before `exp`. Re-mint, don't refresh.

### Secret storage

The PEM has newlines that some UIs mangle on paste. Two safe options:

1. Store the raw PEM — `importPKCS8` accepts multi-line input.
2. Store as base64-encoded PEM and decode at boot:

```ts
const raw = process.env.CANTON_JWT_PRIVATE_KEY!.trim();
const pem = raw.includes("BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8");
```

Public cert is baked into the Docker image; don't ship it as a secret (it's public by design).

## Path B — Seaport / Devnet (OIDC `client_credentials`)

```ts
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
  const json = await res.json();
  return json.access_token as string;
}
```

Cache per-`client_id` keyed by `expires_in - 30s`. The runtime client's `sub` claim becomes the ledger user id — derive it explicitly:

```ts
import { decodeJwt } from "jose";

export async function getRuntimeLedgerUserId(): Promise<string> {
  const token = await getRuntimeToken();
  const { sub } = decodeJwt(token);
  if (!sub) throw new Error("runtime token has no `sub` claim");
  return sub;  // opaque (e.g. "6", a UUID); pass through verbatim
}
```

Then use that id for **both** the `userId` field in commands and the user you grant rights to. Mismatch = opaque `403 security-sensitive error`. See `seaport-devnet.md`.

## Wallet SDK clients must rebuild on token rotation

If you wrap the JSON API with `@canton-network/wallet-sdk` (or any client using `auth.method: "static"`), the static token doesn't auto-rotate. Cache the SDK by token value and rebuild when it changes:

```ts
let cached: { sdk: Promise<SDKInterface>; token: string } | null = null;

export async function getSdk() {
  const jwt = await getLedgerToken();
  if (cached?.token === jwt) return cached.sdk;
  const sdk = SDK.create({ ledgerClientUrl: url, auth: { method: "static", token: jwt }, ... });
  cached = { sdk, token: jwt };
  return sdk;
}
```
