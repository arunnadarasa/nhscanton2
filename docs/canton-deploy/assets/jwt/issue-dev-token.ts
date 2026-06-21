// Mint an HS256 JWT accepted by a Canton 3.x participant configured with
// `unsafe-jwt-hmac-256`. Matches the audience-based token shape Canton 3
// expects (no more `https://daml.com/ledger-api` namespaced claim; `actAs`
// is granted server-side via the Users API, not baked into the token).
//
// Usage:
//   export CANTON_AUTH_SECRET='same value as canton.conf / .env'
//   bun run issue-dev-token.ts \
//     --participant nhs-participant-1 \
//     --user lovable-nhs-app \
//     --ttl 7776000        # 90 days
//
// To grant the user the right to act/read as parties (one-off, after
// allocating parties):
//
//   curl -X POST https://<json-api>/v2/users/<userId>/rights \
//     -H "Authorization: Bearer <admin-jwt>" \
//     -H "Content-Type: application/json" \
//     -d '{ "rights": [
//             { "kind": { "CanActAs":  { "party": "DHSC::1220..." } } },
//             { "kind": { "CanActAs":  { "party": "NHSEngland::1220..." } } },
//             { "kind": { "CanReadAs": { "party": "Auditor::1220..." } } }
//           ] }'

import { SignJWT } from "jose";

type Args = {
  participant: string;
  user: string;
  ttl: number;
  admin: boolean;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    participant: get("--participant") ?? "nhs-participant-1",
    user: get("--user") ?? "lovable-nhs-app",
    ttl: Number(get("--ttl") ?? 60 * 60 * 24 * 30), // 30 days default
    admin: argv.includes("--admin"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = process.env.CANTON_AUTH_SECRET;
  if (!secret) {
    console.error("CANTON_AUTH_SECRET env var is required");
    process.exit(1);
  }

  // Canton 3 audience-based token. `aud` must match `target-audience` in
  // canton.conf; `sub` is the ledger user id whose rights govern actAs/readAs.
  const jwt = await new SignJWT({
    ...(args.admin ? { scope: "daml_ledger_api admin" } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(args.user)
    .setAudience(`https://daml.com/jwt/aud/participant/${args.participant}`)
    .setIssuedAt()
    .setExpirationTime(`${args.ttl}s`)
    .sign(new TextEncoder().encode(secret));

  console.log(jwt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
