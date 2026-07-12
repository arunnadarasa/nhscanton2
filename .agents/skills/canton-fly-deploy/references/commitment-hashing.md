# Commitment hashing (Daml ↔ frontend SHA-256 parity)

If your Daml template stores a commitment — a hash of some pre-image, so parties can prove knowledge later without publishing the plaintext — the on-ledger hash and the frontend hash MUST produce identical bytes for the same input. Divergence here is silent: contracts submit fine, dashboards render, then an auditor tries to reconcile a pre-image and nothing matches.

## The rule

Both sides:
1. Encode the input as **UTF-8 bytes**.
2. Compute **SHA-256** on those bytes.
3. Serialize the digest as **lowercase hex** (32 bytes → 64 chars, `[0-9a-f]`).

Anything else — identity, MD5, SHA-256 over UTF-16, uppercase hex, base64, trimming whitespace — will diverge somewhere.

## Daml

```haskell
module Nhs.Commitments where

import DA.Text (sha256)

hashText : Text -> Text
hashText t = sha256 t
```

`DA.Text.sha256` returns lowercase hex. Do not roll your own. Do not leave a placeholder identity function in during development — you will forget to fix it, and every frontend hash will look wrong for reasons that are hard to trace.

## Frontend (TypeScript, browser + edge worker)

Prefer Web Crypto when available (browsers, modern Node, Cloudflare Workers with `nodejs_compat`, Deno):

```ts
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

If you need a sync API (form validation while the user types, no top-level await), inline a FIPS 180-4 implementation and call it synchronously. Keep the async variant available for the actual submit path so you're not carrying the inline impl into hot code.

## Parity test (do this once, keep it in CI)

```ts
// src/lib/canton/__tests__/commitment.test.ts
import { describe, it, expect } from "vitest";
import { sha256Hex } from "../commitments";

describe("hashText parity with Daml DA.Text.sha256", () => {
  const cases: Array<[string, string]> = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["hello", "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"],
    ["NHS-DHSC-2026-Q1", /* pre-computed in the daml repl */ ""],
  ];
  for (const [input, expected] of cases) {
    if (!expected) continue;
    it(`hashes ${JSON.stringify(input)}`, async () => {
      expect(await sha256Hex(input)).toBe(expected);
    });
  }
});
```

Generate the third case by opening `daml repl` against your DAR and running `DA.Text.sha256 "NHS-DHSC-2026-Q1"`. Copy the string in verbatim.

## Common divergences (what to check first when hashes don't match)

- **Identity `hashText` still in Daml.** Grep `hashText t = t` — it will typecheck.
- **UTF-16 on the frontend.** `new TextEncoder()` is UTF-8; a homegrown `[...str].map(c => c.charCodeAt(0))` is UTF-16 code units. Wrong for anything outside ASCII.
- **Trimming or normalising unicode on one side only.** Pick one: either both sides `.trim().normalize("NFC")` before encoding, or neither. Document the choice next to `hashText`.
- **Uppercase vs lowercase hex.** `DA.Text.sha256` is lowercase. Match it.
- **Different string being hashed.** Log the exact bytes both sides feed to the hash. Ninety percent of the time the divergence is upstream of the hash function — a Daml `show` around a record vs a hand-built TS concatenation of fields in a different order.
