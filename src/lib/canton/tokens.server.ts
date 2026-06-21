// Access-token façade. Branches on CANTON_MODE so call sites
// (live.server.ts, admin.deploy.ts, …) stay mode-agnostic.

import { decodeJwt } from "jose";
import { cantonEnv, getCantonMode } from "./mode.server";

export async function getRuntimeAccessToken(): Promise<string> {
  const mode = getCantonMode();
  if (mode === "devnet") {
    const { getOidcToken } = await import("./oidc-token.server");
    return getOidcToken("runtime");
  }
  // localnet (default for live mode without OIDC)
  const { getCantonLedgerAccessToken } = await import("./admin-token.server");
  return getCantonLedgerAccessToken();
}

export async function getAdminAccessToken(): Promise<string> {
  const mode = getCantonMode();
  if (mode === "devnet") {
    const { getOidcToken } = await import("./oidc-token.server");
    return getOidcToken("bootstrap");
  }
  const { getCantonAdminAccessToken } = await import("./admin-token.server");
  return getCantonAdminAccessToken();
}

/**
 * Canton user id the runtime token authenticates as.
 *
 * Devnet (OIDC): Canton's user-based auth treats the JWT `sub` (or the
 * legacy `https://daml.com/ledger-api` `applicationId`) as the user id.
 * Commands submitted with a different `userId` are rejected with a
 * "security-sensitive" 403, so we MUST derive the user id from the real
 * token and create/grant rights to that same id.
 *
 * Localnet / memory: keep the configured/default `lovable-nhs-app`.
 */
export async function getRuntimeLedgerUserId(): Promise<string> {
  const mode = getCantonMode();
  const fallback = cantonEnv("USER_ID") ?? "lovable-nhs-app";
  if (mode !== "devnet") return fallback;
  try {
    const jwt = await getRuntimeAccessToken();
    const claims = decodeJwt(jwt) as {
      sub?: string;
      "https://daml.com/ledger-api"?: { applicationId?: string };
    };
    const damlApp = claims["https://daml.com/ledger-api"]?.applicationId;
    return damlApp ?? claims.sub ?? fallback;
  } catch {
    return fallback;
  }
}
