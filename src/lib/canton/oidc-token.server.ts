// OIDC client_credentials token client for the Seaport-managed (devnet)
// validator. Tokens are cached per (network, kind) until ~30s before expiry.
//
// SERVER ONLY.
//
// Required env (devnet mode, namespaced or legacy):
//   CANTON_DEVNET_OIDC_TOKEN_URL                — OIDC token endpoint
//   CANTON_DEVNET_OIDC_AUDIENCE                 — `aud` claim the validator expects
//   CANTON_DEVNET_OIDC_SCOPE                    — optional scope string
//   CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID/SECRET — runtime user (reads/writes)
//   CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID/SECRET — admin-ish user (party alloc)
//
// Escape hatch (smoke tests):
//   CANTON_DEVNET_OIDC_STATIC_TOKEN — if set, returned verbatim for both kinds

import { cantonEnv, currentCantonNetwork } from "./mode.server";

type Cache = { token: string; expiresAt: number };
const caches: Map<string, Cache> = new Map(); // key = `${network}:${kind}`

export type OidcTokenKind = "bootstrap" | "runtime";

function envFor(kind: OidcTokenKind): { clientId?: string; clientSecret?: string } {
  if (kind === "bootstrap") {
    return {
      clientId:
        cantonEnv("OIDC_BOOTSTRAP_CLIENT_ID") ?? cantonEnv("OIDC_RUNTIME_CLIENT_ID"),
      clientSecret:
        cantonEnv("OIDC_BOOTSTRAP_CLIENT_SECRET") ?? cantonEnv("OIDC_RUNTIME_CLIENT_SECRET"),
    };
  }
  return {
    clientId: cantonEnv("OIDC_RUNTIME_CLIENT_ID"),
    clientSecret: cantonEnv("OIDC_RUNTIME_CLIENT_SECRET"),
  };
}

export async function getOidcToken(kind: OidcTokenKind = "runtime"): Promise<string> {
  const staticToken = cantonEnv("OIDC_STATIC_TOKEN");
  if (staticToken) return staticToken;

  const network = currentCantonNetwork();
  const cacheKey = `${network}:${kind}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = caches.get(cacheKey);
  if (cached && cached.expiresAt - 30 > now) return cached.token;

  const tokenUrl = cantonEnv("OIDC_TOKEN_URL");
  const audience = cantonEnv("OIDC_AUDIENCE");
  const scope = cantonEnv("OIDC_SCOPE");
  const { clientId, clientSecret } = envFor(kind);

  if (!tokenUrl) throw new Error("CANTON_OIDC_TOKEN_URL not set");
  if (!clientId || !clientSecret) {
    throw new Error(
      `OIDC client_credentials for kind="${kind}" not set (CANTON_OIDC_${kind === "bootstrap" ? "BOOTSTRAP" : "RUNTIME"}_CLIENT_ID/SECRET)`,
    );
  }

  // Some IdPs (e.g. Authentik used by Seaport) expect client_id/secret in the
  // form body rather than Basic auth. Send both for compatibility.
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (audience) body.set("audience", audience);
  if (scope) body.set("scope", scope);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`OIDC token (${kind}) ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error(`OIDC token (${kind}): missing access_token`);

  const expiresAt = now + (json.expires_in ?? 300);
  caches.set(cacheKey, { token: json.access_token, expiresAt });
  return json.access_token;
}
