# DAR lifecycle: build, upload, upgrade

What "ship a new Daml change to a live ledger" actually involves, and the traps along the way.

## Build

Canton 3.5+ uses **`dpm`** (the Daml Package Manager). Install once:

```bash
curl -sSf https://get.daml.com/dpm | sh
dpm install sdk 3.5.1
```

Then from the package root (the dir with `daml.yaml`):

```bash
dpm build              # → .daml/dist/<name>-<version>.dar
```

Common build failure (CI / Seaport / remote Fly build):

```
./.daml/package-database/2.2: getDirectoryContents:openDirStream: does not exist
```

A partial `.daml/` cache got committed (typically `package-database/metadata.json` advertising SDK 2.2, but no `2.2/` subdir). Fix:

```bash
rm -rf daml/.daml
echo ".daml/" >> daml/.gitignore
```

## Upload

```ts
const dar = await fetch(`${origin}/dars/nhs-budget-app-v2-1.0.1.dar.bin`).then(r => r.arrayBuffer());
const res = await fetch(`${JSON_API}/v2/dars`, {
  method: "POST",
  headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/octet-stream" },
  body: dar,
});
// 200 = uploaded, 409 = same hash already present (idempotent success).
```

**Re-upload on every deploy.** The build can produce a new package hash for the same logical version (different transitive deps, different SDK patch), and the app references templates by package id — a stale upload silently breaks new templates. Don't optimize this away.

## Serving DARs over Cloudflare

`.dar` is on Cloudflare's blocked-extension list and returns 403/451 with no body. Workaround: **rename to `.dar.bin`** and serve with `content-type: application/octet-stream`. Both the asset filename and the URL the deploy code fetches must end in `.dar.bin`.

## The `KNOWN_PACKAGE_VERSION` trap (and how to escape it)

Canton enforces that a re-upload of `name-X.Y.Z` either matches a previous hash byte-for-byte or fails. A breaking schema change to a template (rename a field, change `Optional Party` → `Optional Text`, add a required field) is **not** a backward-compatible upgrade. Bumping `1.0.0` → `1.0.1` under the same package name returns:

```
KNOWN_PACKAGE_VERSION: …already exists with a different content hash
```

### Three options

1. **Proper Daml upgrade DAR** (production). Add the old package as a `data-dependency`, write an explicit migration choice. Out of scope for hackathon pace.
2. **Rename the package** (recommended for demos). In `daml.yaml`:

   ```yaml
   name: nhs-budget-app-v2     # was: nhs-budget-app
   version: 1.0.1
   ```

   Update every TS reference (`DAR_ASSET_PATH`, template-id helpers, `#nhs-budget-…` strings). Canton treats it as a fresh package; old contracts under the old name remain queryable but inert; the new templates are immediately usable. Old templates that didn't change are also available under the new name — no migration needed.
3. **Wipe the participant** (Fly only). Destroy the volume, redeploy. Only works on self-hosted.

## Free text vs Party — the modelling rule

A `Party` in Daml MUST be a real ledger participant. Sending user-typed text as a `Party` field fails at submission:

```
UNKNOWN_INFORMEES: Submitter cannot act on behalf of unknown party 'AstraZeneca'
```

Anything a user types into a text input (supplier name, freeform memo, label) → **`Optional Text`**. If the field needs both a human label *and* an on-chain identity (e.g. a supplier you'll later pay in USDCx), model them as two separate fields:

```daml
template Invoice
  with
    supplierName  : Optional Text     -- free text, displayed in the UI
    supplierParty : Optional Party    -- optional on-chain identity for payment
    ...
```

This isn't a stylistic choice — it's required if the field can ever hold a string the participant has not allocated.

## Multi-DAR deploys

Order matters: upload the main app DAR first, then any feeder DARs (mock-USDCx, custom tokens). After upload, the order they appear in `/v2/dars` doesn't matter, but if a template in DAR B references a type from DAR A and you upload B first, parties won't be allocated correctly because the bootstrap doesn't know A's parties exist yet.

```ts
await uploadDar(adminToken, "/dars/nhs-budget-app-v2-1.0.1.dar.bin");
await uploadDar(adminToken, "/dars/mock-usdcx-1.0.0.dar.bin");
```

After uploading mock-USDCx (or any DAR whose templates have a new signatory), grant the runtime user `CanActAs` on the new signatory party. The cleanest pattern: grant `CanActAs` on **every** allocated party. The "Auditor is read-only" optimization breaks the moment Auditor becomes an issuer.

## Template-id resolution

JSON Ledger API v2 accepts the `#<package-name>:Module:Template` shorthand and resolves it to the **latest uploaded version** of that package:

```ts
const usdcxTemplateId = "#mock-usdcx:MockUsdcx:Holding";
// resolves to <hash>:MockUsdcx:Holding at submission time
```

Convenient for demo DARs you control. For DARs you don't own (real Circle xReserve USDCx, partner-published templates), pin a specific package id via env (`CANTON_USDCX_PACKAGE_ID`) so an upstream rename doesn't quietly switch you to a different contract.
