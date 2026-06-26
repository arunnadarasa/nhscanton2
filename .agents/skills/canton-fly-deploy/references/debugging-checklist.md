# Debugging checklist

Symptom → most-likely cause → fix. Work top-down.

## `403 "A security-sensitive error has been received"` (Devnet, opaque)

Canton deliberately strips detail to avoid leaking schema info. In 9 cases out of 10 it's one of:

1. **Missing `CanActAs` on a signatory party.** Most common after uploading a new DAR — e.g. you treated `Auditor` as observer-only but it's a signatory on `mock-usdcx`. Re-run bootstrap with `CanActAs` granted on **every** allocated party.
2. **`userId` in the command body doesn't match the runtime token's `sub` claim.** See `seaport-devnet.md` — derive `userId` from `decodeJwt(token).sub`, never hardcode.
3. **`actAs` includes a party your runtime user has no rights on.** Same as (1).

Test (1) first — it's both the most common and the cheapest to verify.

## `PERMISSION_DENIED` on every ledger read

You're using the admin/bootstrap token for ledger queries. Admin grants don't include data access.

Fix: create a runtime user, grant `CanReadAs` / `CanActAs`, mint tokens with `sub: <that user id>`. See `jwt-auth.md`.

## `UNKNOWN_INFORMEES: Submitter cannot act on behalf of unknown party 'X'`

You sent user-typed text into a `Party` field. `Party` MUST be a real ledger participant. Change the field to `Optional Text` (and add a separate `Optional Party` if you need on-chain identity too). See `references/dar-lifecycle.md` → "Free text vs Party".

## `KNOWN_PACKAGE_VERSION` on DAR upload

You changed a template and bumped the patch version under the same package name. Canton refuses because the new hash differs from the previously-uploaded `1.0.X`. Bump the package **name** (`foo` → `foo-v2`) instead. See `dar-lifecycle.md`.

## `Couldn't find template <pkgid>:Module:Template` after a deploy

The DAR wasn't re-uploaded; the app references a package id that's not installed (or that an older bootstrap once installed, then a fresh participant didn't). Force DAR upload on every deploy — don't gate it on "if not present". See `bootstrap-flow.md`.

## `404 UNKNOWN_RESOURCE: Provided parties have not been found` (Fly)

The parties listed exist on a **different participant** than the one serving requests. You're running multi-machine.

Verify:
```bash
flyctl machines list -a "$APP_NAME"     # > 1 machine?
```

Look at the bootstrap response — party IDs with two distinct fingerprints (`Name::<fpA>` vs `Name::<fpB>`) is the smoking gun.

Fix: `flyctl scale count 1 -a "$APP_NAME" --yes`, destroy extras, re-run bootstrap. See `fly-single-machine.md`.

## `404 USER_NOT_FOUND` on rights grant

The user exists on a destroyed machine, or was never created on this one. Re-run step 4 (create user) before step 5 (rights). On Devnet, also verify the user id you're granting rights to matches the runtime token's `sub`.

## `400 Invalid value for: body (Missing required field at 'isDeactivated')` on `POST /v2/users`

`user` must include `id`, `primaryParty`, `isDeactivated`, `metadata`, `identityProviderId`. See `json-ledger-api-v2.md`.

## `400 Invalid value for: body` on `POST /v2/users/{id}/rights`

Two common causes:

1. Missing top-level `userId` and `identityProviderId: ""` in the body (yes, even though the URL has the user id).
2. Wrong rights shape. The correct shape is **doubly-nested**:

   ```json
   { "kind": { "CanActAs": { "value": { "party": "..." } } } }
   ```

   NOT `{ "kind": { "CanActAs": { "party": "..." } } }`.

## `Canton: no CreatedEvent in transaction` after submission

You called `/v2/commands/submit-and-wait` and tried to read `transaction.events`. That endpoint returns only `{ updateId, completionOffset }`. Switch to `/v2/commands/submit-and-wait-for-transaction` with the wrapped body. See `json-ledger-api-v2.md`.

## `400 Missing required field at 'commands.commands'` on submit

You're hitting `/v2/commands/submit-and-wait-for-transaction` with the flat body shape that `submit-and-wait` accepts. Wrap it:

```json
{ "commands": { "commands": [...], "userId": "...", "commandId": "...", "actAs": [...], "readAs": [] } }
```

## `502` from `GET /v2/parties` on Devnet

Unpaged call against a 10k+ party network times out through Cloudflare. Use `pageSize=2000` + `pageToken` and accumulate. See `seaport-devnet.md` → "Paginated party resolution".

## `403` / `451` fetching `/dars/foo.dar` from Cloudflare

`.dar` is on Cloudflare's blocked-extension list. Rename the served asset to `.dar.bin` and update the fetch path. See `dar-lifecycle.md`.

## App lists are empty even though `getActiveContracts` returns rows

Contract payloads come back with **fully-qualified** party ids (`NHSEngland::1220...37d6`). Client code that filters with `payload.allocator === "NHSEngland"` will never match. Compare by prefix:

```ts
const sameParty = (p: string, name: string) =>
  p === name || p.startsWith(`${name}::`);
```

Or resolve via the bootstrap-persisted mapping before filtering.

## `Authorization: Bearer ...` rejected with `UNAUTHENTICATED`

- `aud` mismatch — must match `canton.conf` / IdP-registered audience.
- Token expired — TTL is short; check `iat` / `exp`.
- Wrong key (Fly) — participant's public cert doesn't match the private key. Re-bake or re-issue.
- Wrong OIDC client (Devnet) — bootstrap and runtime clients may have different audiences.

## `503` or connection refused (Fly)

Canton is still booting. Wait up to 60s. If it never comes up:

```bash
flyctl logs -a "$APP_NAME" --no-tail | tail -n 200
```

Look for OOM (`OutOfMemoryError`, `Killed`), config parse errors, or port-binding failures. If OOM, bump the VM to 4 GB and raise `JAVA_OPTS=-Xmx3000m`.

## Participant fingerprint changed unexpectedly (Fly)

You destroyed and recreated the volume. The participant generates a fresh identity on first boot — all stored party IDs are stale.

Fix: re-run bootstrap. It re-allocates everything fresh and updates `canton_parties`.

## After everything passes, app still shows empty data

Expected on a freshly-bootstrapped ledger. Create one contract via your allocator and verify it appears. If it doesn't:

- `liveQuery` filtering by a party your runtime user has no `CanReadAs` on. Add it and re-run step 5.
- You created the contract acting as a party your runtime user has no `CanActAs` on — Canton would have refused at command time, so check submission logs.
- Filter compares logical party name against fully-qualified payload party — see "App lists are empty" above.

## `dpm build` fails with `./.daml/package-database/2.2: getDirectoryContents:openDirStream: does not exist`

A partial `.daml/` cache got committed. Fix:

```bash
rm -rf daml/.daml
echo ".daml/" >> daml/.gitignore
```

Re-run; `dpm` repopulates the package-db cleanly.
