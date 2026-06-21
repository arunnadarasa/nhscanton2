# Canton JWT auth (RS256, two subjects)

Canton 3.x ledger API auth: every request must carry `Authorization: Bearer <JWT>`, signed RS256 with a key the participant trusts. The participant config points at a public certificate; the app mints tokens locally with the matching private key.

## Two subjects, two purposes

| Subject | Use for | Extra claims |
| --- | --- | --- |
| `participant_admin` | DAR upload, party allocation, user/rights mgmt — anything under `/v2/parties`, `/v2/users`, `/v2/dars` | `participantAdmin: true` |
| `<runtime-user-id>` (e.g. `lovable-nhs-app`) | All ledger reads (`/v2/state/...`), command submission (`/v2/commands`), update streams | none |

**The admin JWT does NOT authorize ledger reads.** If you use it for `getActiveContracts`, you get `PERMISSION_DENIED`. Mint a separate token whose `sub` matches a ledger user you've created with `CanActAs` / `CanReadAs` rights on the relevant parties.

## Common claims

```ts
{
  sub:   "participant_admin"           // or "<runtime-user-id>"
  aud:   "canton-ledger-api"           // must match canton.conf
  scope: "daml_ledger_api daml_ledger_api.admin"
  participantAdmin: true               // ONLY on the admin token
  iat:   <now>
  exp:   <now + 300>                   // 5 min TTL is plenty; cache + refresh
}
```

Header: `{ alg: "RS256", typ: "JWT" }`.

## Minting with jose (TypeScript)

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

## Secret storage

The private key is too large for a single env var line if stored as raw PEM with newlines. Two options that both work:

1. Store the raw PEM verbatim — `importPKCS8` accepts multi-line input.
2. Store as base64-encoded PEM (survives copy-paste through any UI) and decode at boot:

```ts
const raw = process.env.CANTON_JWT_PRIVATE_KEY!.trim();
const pem = raw.includes("BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8");
```

Generate the keypair once and persist alongside the participant's public cert. Re-using the same key across redeploys means tokens issued before a restart stay valid.

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
