// Mint short-lived (5 min) Canton admin JWTs locally using RS256.
//
// SERVER ONLY. Never import from client code.
//
// Required env (per network, with namespaced fallback to legacy unprefixed):
//   - CANTON_FLY_JWT_PRIVATE_KEY (or CANTON_JWT_PRIVATE_KEY)
//
// Token claims (Daml user-based auth, participant_admin grant):
//   sub:               "participant_admin"
//   aud:               "canton-ledger-api"
//   scope:             "daml_ledger_api daml_ledger_api.admin"
//   participantAdmin:  true
//   exp:               now + 300

import { SignJWT, importPKCS8 } from "jose";
import { cantonEnv, currentCantonNetwork } from "./mode.server";

type TokenCache = { token: string; expiresAt: number };

// Caches are keyed by network so flipping the toggle doesn't reuse a
// token minted with a different participant's key.
const adminCache: Map<string, TokenCache> = new Map();
const ledgerCache: Map<string, TokenCache> = new Map();
const signingKeyCache: Map<string, CryptoKey> = new Map();

const AUDIENCE = "canton-ledger-api";
const TTL_SECONDS = 300;
const ADMIN_SUBJECT = "participant_admin";

function ledgerUserId() {
  return cantonEnv("USER_ID") ?? "lovable-nhs-app";
}

function decodePem(): string {
  const raw = cantonEnv("JWT_PRIVATE_KEY");
  if (!raw) {
    throw new Error(
      "CANTON_JWT_PRIVATE_KEY (or CANTON_FLY_JWT_PRIVATE_KEY) secret is not set. Run scripts/deploy-canton-fly.sh and paste the value into Project Settings → Secrets.",
    );
  }
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  try {
    return Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    throw new Error("CANTON_JWT_PRIVATE_KEY is neither raw PEM nor base64-encoded PEM");
  }
}

async function getSigningKey(network: string): Promise<CryptoKey> {
  const cached = signingKeyCache.get(network);
  if (cached) return cached;
  const key = await importPKCS8(decodePem(), "RS256");
  signingKeyCache.set(network, key);
  return key;
}

async function mintToken(subject: string, extra: Record<string, unknown> = {}) {
  const network = currentCantonNetwork();
  const key = await getSigningKey(network);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + TTL_SECONDS;
  const token = await new SignJWT({
    scope: "daml_ledger_api daml_ledger_api.admin",
    ...extra,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(subject)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: exp, network };
}

export async function getCantonAdminAccessToken(): Promise<string> {
  const network = currentCantonNetwork();
  const now = Math.floor(Date.now() / 1000);
  const cached = adminCache.get(network);
  if (cached && cached.expiresAt - 30 > now) return cached.token;
  const minted = await mintToken(ADMIN_SUBJECT, { participantAdmin: true });
  adminCache.set(network, { token: minted.token, expiresAt: minted.expiresAt });
  return minted.token;
}

/** Token for ledger reads/writes — subject is the runtime user with party rights. */
export async function getCantonLedgerAccessToken(): Promise<string> {
  const network = currentCantonNetwork();
  const now = Math.floor(Date.now() / 1000);
  const cached = ledgerCache.get(network);
  if (cached && cached.expiresAt - 30 > now) return cached.token;
  const minted = await mintToken(ledgerUserId());
  ledgerCache.set(network, { token: minted.token, expiresAt: minted.expiresAt });
  return minted.token;
}

export async function mintCantonTokenForUser(userId: string) {
  return mintToken(`user-${userId}`);
}
