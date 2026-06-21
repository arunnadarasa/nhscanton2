// Mode selector for the Canton ledger client. Picks one of:
//   - "memory"   — in-process demo ledger
//   - "localnet" — self-hosted (e.g. Fly.io) participant, RS256 JWT minted locally
//   - "devnet"   — Seaport-managed 5N Sandbox validator, OIDC client_credentials
//
// SERVER ONLY. Reads process.env at call time (Worker env binds per request).
//
// Per-request override:
//   A `canton_network` cookie ("fly" | "seaport" | "memory") set by the
//   header pill can switch the active network without redeploying. The
//   cookie value just biases env-var lookups: each var is looked up first
//   under the namespaced key (e.g. CANTON_FLY_JSON_API_URL), then under the
//   legacy unprefixed key (CANTON_JSON_API_URL). If no endpoint is
//   configured for the chosen network we fall back to memory.

import { getCookie } from "@tanstack/react-start/server";

export type CantonNetwork = "memory" | "localnet" | "devnet";

const COOKIE_NAME = "canton_network";

/** Cookie alias → internal network name. */
function aliasToNetwork(v: string | undefined | null): CantonNetwork | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s === "fly" || s === "localnet") return "localnet";
  if (s === "seaport" || s === "devnet") return "devnet";
  if (s === "memory") return "memory";
  return null;
}

/** Internal network name → cookie alias (what the UI shows). */
export function networkToAlias(n: CantonNetwork): "fly" | "seaport" | "memory" {
  if (n === "localnet") return "fly";
  if (n === "devnet") return "seaport";
  return "memory";
}

function readCookieNetwork(): CantonNetwork | null {
  try {
    return aliasToNetwork(getCookie(COOKIE_NAME));
  } catch {
    // Not in a request context (e.g. build-time prerender)
    return null;
  }
}

/** ENV prefix for a network. */
function prefixFor(n: CantonNetwork): string | null {
  if (n === "localnet") return "CANTON_FLY_";
  if (n === "devnet") return "CANTON_DEVNET_";
  return null;
}

/**
 * Look up a CANTON_* env var with network-namespaced precedence.
 * `suffix` is the part after `CANTON_` (e.g. "JSON_API_URL").
 */
export function cantonEnv(suffix: string, network: CantonNetwork = currentCantonNetwork()): string | undefined {
  const pfx = prefixFor(network);
  if (pfx) {
    const ns = process.env[`${pfx}${suffix}`];
    if (ns) return ns;
  }
  return process.env[`CANTON_${suffix}`];
}

/** True if the given network has at least one endpoint URL configured. */
export function isNetworkConfigured(n: CantonNetwork): boolean {
  if (n === "memory") return true;
  const pfx = prefixFor(n);
  const url =
    (pfx && process.env[`${pfx}JSON_API_URL`]) ||
    process.env.CANTON_JSON_API_URL;
  if (!url) return false;
  if (n === "localnet") {
    return !!(
      (pfx && process.env[`${pfx}JWT_PRIVATE_KEY`]) ||
      process.env.CANTON_JWT_PRIVATE_KEY
    );
  }
  if (n === "devnet") {
    const hasOidc =
      (pfx && process.env[`${pfx}OIDC_TOKEN_URL`]) ||
      process.env.CANTON_OIDC_TOKEN_URL;
    const hasClient =
      (pfx && (process.env[`${pfx}OIDC_RUNTIME_CLIENT_ID`] || process.env[`${pfx}OIDC_STATIC_TOKEN`])) ||
      process.env.CANTON_OIDC_RUNTIME_CLIENT_ID ||
      process.env.CANTON_OIDC_STATIC_TOKEN;
    return !!(hasOidc && hasClient);
  }
  return false;
}

/** What networks the operator has wired up secrets for. */
export function getNetworkAvailability(): { memory: true; fly: boolean; seaport: boolean } {
  return {
    memory: true,
    fly: isNetworkConfigured("localnet"),
    seaport: isNetworkConfigured("devnet"),
  };
}

/** Resolve the active network for this request. Cookie > CANTON_MODE > auto-detect. */
export function currentCantonNetwork(): CantonNetwork {
  // 1. Cookie override (per-browser toggle)
  const cookie = readCookieNetwork();
  if (cookie && isNetworkConfigured(cookie)) return cookie;
  if (cookie === "memory") return "memory";

  // 2. Explicit CANTON_MODE
  const explicit = (process.env.CANTON_MODE ?? "").toLowerCase();
  if (explicit === "localnet" || explicit === "devnet" || explicit === "memory") {
    return explicit as CantonNetwork;
  }

  // 3. Default to memory. Live networks (Fly/Devnet) only activate when the
  //    user explicitly opts in via the header pill, so a dead endpoint can't
  //    blank-screen the demo on first load.
  return "memory";
}

/** Back-compat: identical to currentCantonNetwork(). */
export function getCantonMode(): CantonNetwork {
  return currentCantonNetwork();
}

export function getCantonEndpoints(): { ledgerApi?: string; adminApi?: string } {
  const ledgerApi = cantonEnv("JSON_API_URL")?.replace(/\/+$/, "");
  const adminApi = (cantonEnv("ADMIN_API_URL") ?? cantonEnv("JSON_API_URL"))?.replace(/\/+$/, "");
  return { ledgerApi, adminApi };
}
