// Smoke test for @canton-network/wallet-sdk under Cloudflare workerd.
// Confirms the SDK bundles + that pure-JS bits (Ed25519 key gen, offline
// SDK construction) run on the Worker SSR runtime. No participant required.
//
// NB: The published Canton docs reference WalletSDKImpl / createKeyPair —
// the actual 1.3 SDK exports the `SDK` class with a static `createOffline`
// factory. Key generation is on `sdk.keys.generate()`.

import { createServerFn } from "@tanstack/react-start";

export type WalletSdkSmokeResult =
  | {
      ok: true;
      sdkVersion: string;
      offlineConstructed: boolean;
      publicKeyLength: number;
      privateKeyLength: number;
      fingerprintLength: number;
    }
  | {
      ok: false;
      stage: "import" | "createOffline" | "generateKey" | "fingerprint";
      error: string;
    };

export const walletSdkSmokeTest = createServerFn({ method: "GET" }).handler(
  async (): Promise<WalletSdkSmokeResult> => {
    let mod: typeof import("@canton-network/wallet-sdk");
    try {
      mod = await import("@canton-network/wallet-sdk");
    } catch (e) {
      return {
        ok: false,
        stage: "import",
        error: e instanceof Error ? e.message : String(e),
      };
    }

    let offlineSdk: ReturnType<typeof mod.SDK.createOffline>;
    try {
      offlineSdk = mod.SDK.createOffline();
    } catch (e) {
      return {
        ok: false,
        stage: "createOffline",
        error: e instanceof Error ? e.message : String(e),
      };
    }

    let keyPair: { publicKey: string; privateKey: string };
    try {
      keyPair = offlineSdk.keys.generate();
    } catch (e) {
      return {
        ok: false,
        stage: "generateKey",
        error: e instanceof Error ? e.message : String(e),
      };
    }

    let fingerprint = "";
    try {
      fingerprint = await offlineSdk.keys.fingerprint(keyPair.publicKey);
    } catch (e) {
      return {
        ok: false,
        stage: "fingerprint",
        error: e instanceof Error ? e.message : String(e),
      };
    }

    // Version from installed dependency declaration (avoids JSON import).
    let sdkVersion = "unknown";
    try {
      const pkg = (await import("../../../package.json")) as {
        default?: { dependencies?: Record<string, string> };
      };
      sdkVersion =
        pkg.default?.dependencies?.["@canton-network/wallet-sdk"] ?? "unknown";
    } catch {
      // non-fatal
    }

    return {
      ok: true,
      sdkVersion,
      offlineConstructed: true,
      publicKeyLength: keyPair.publicKey.length,
      privateKeyLength: keyPair.privateKey.length,
      fingerprintLength: fingerprint.length,
    };
  },
);
