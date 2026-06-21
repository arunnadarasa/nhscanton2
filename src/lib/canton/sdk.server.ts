// Lazy-initialised Wallet SDK client for the live Canton JSON Ledger API.
// Cached per (network + token) so a runtime toggle of the active network
// rebuilds the SDK against the new participant.

import type { SDKInterface } from "@canton-network/wallet-sdk";
import { getCantonLedgerAccessToken } from "./admin-token.server";
import { cantonEnv, currentCantonNetwork } from "./mode.server";

export function getUserId() {
  return cantonEnv("USER_ID") ?? "lovable-nhs-app";
}

type Entry = { sdk: Promise<SDKInterface>; token: string; network: string };
const cached: Map<string, Entry> = new Map();

export async function getWalletSdk(): Promise<SDKInterface> {
  const url = cantonEnv("JSON_API_URL");
  if (!url) throw new Error("Canton live endpoint not configured");

  const network = currentCantonNetwork();
  const jwt = await getCantonLedgerAccessToken();
  const existing = cached.get(network);
  if (existing && existing.token === jwt) return existing.sdk;

  const cleanUrl = url.replace(/\/$/, "");
  const sdk = import("@canton-network/wallet-sdk")
    .then(({ SDK }) =>
      SDK.create({
        ledgerClientUrl: cleanUrl,
        auth: { method: "static", token: jwt },
        logAdapter: "console",
      }),
    )
    .catch((e) => {
      if (cached.get(network)?.token === jwt) cached.delete(network);
      throw e;
    });
  cached.set(network, { sdk, token: jwt, network });
  return sdk;
}
