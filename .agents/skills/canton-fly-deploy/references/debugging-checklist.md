# Debugging checklist

Symptom → most-likely cause → fix. Work top-down.

## `PERMISSION_DENIED` on every ledger read

You're using the admin JWT (`sub: participant_admin`) for ledger queries. The admin grant covers node admin endpoints, NOT data access.

Fix: create a runtime user, grant it `CanReadAs` / `CanActAs` on each party, mint tokens with `sub: <that user id>`. See `jwt-auth.md`.

## `404 UNKNOWN_RESOURCE: Provided parties have not been found`

The parties listed in the error exist on a **different participant** than the one currently serving requests. You're running multi-machine.

Verify:
```bash
flyctl machines list -a "$APP_NAME"     # > 1 machine?
```

Look at the bootstrap response — do party IDs contain two distinct fingerprints (`Name::<fpA>` and `Name::<fpB>`)? That's the smoking gun.

Fix: `flyctl scale count 1 -a "$APP_NAME" --yes`, destroy any extra machines, re-run bootstrap. See `fly-single-machine.md`.

## `404 USER_NOT_FOUND` on rights grant

The ledger user exists on a destroyed machine, or was never created on this one. Re-run step 4 of bootstrap (create user) before step 5 (rights).

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

You called `/v2/commands/submit-and-wait` and tried to read `transaction.events`. That endpoint returns only `{ updateId, completionOffset }`. Switch to `/v2/commands/submit-and-wait-for-transaction` and remember the body must be wrapped: `{ commands: { commands, userId, commandId, actAs, readAs } }`. See `json-ledger-api-v2.md`.

## `400 Missing required field at 'commands.commands'` on submit

You're hitting `/v2/commands/submit-and-wait-for-transaction` with the flat body shape that `submit-and-wait` accepts. Wrap the whole thing in a `commands` object:

```json
{ "commands": { "commands": [...], "userId": "...", "commandId": "...", "actAs": [...], "readAs": [] } }
```

## App lists are empty even though `getActiveContracts` returns rows

Contract payloads come back with **fully-qualified** party ids (`NHSEngland::1220...37d6`). Client code that filters with `payload.allocator === "NHSEngland"` will never match. Compare by prefix:

```ts
const sameParty = (p: string, name: string) =>
  p === name || p.startsWith(`${name}::`);
```

Or resolve the logical name to the fully-qualified id via the bootstrap-persisted mapping (see `bootstrap-flow.md`) before filtering.

This is the UI-side counterpart to the "persist the logical→fully-qualified mapping" invariant — bootstrap captures the id, but every read site has to use it (or compare by prefix).

## `Authorization: Bearer ...` rejected with `UNAUTHENTICATED`

- `aud` mismatch — must match `canton.conf` (`canton-ledger-api` is the default in this skill).
- Token expired — TTL is short (5 min by design); check `iat` / `exp`.
- Wrong key — the participant's public cert doesn't match the private key you signed with. Re-bake the cert into the Docker image or re-issue the keypair.

## `503` or connection refused

Canton is still booting. Wait up to 60s. If it never comes up:

```bash
flyctl logs -a "$APP_NAME" --no-tail | tail -n 200
```

Look for OOM (`OutOfMemoryError`, `Killed`), config parse errors, or port-binding failures. If OOM, bump the VM to 4 GB and raise `JAVA_OPTS=-Xmx3000m`.

## Participant fingerprint changed unexpectedly

You destroyed and recreated the volume, or the volume was wiped. The participant generates a fresh identity on first boot. All previously-allocated party IDs are now stale.

Fix: re-run bootstrap. It re-allocates everything fresh and updates the persisted `canton_parties` map.

## Fly machine restarts loop

Health check failing. Check `/v2/state/ledger-end` returns `401` (without auth) or `200` (with admin token). If your `[[services.http_checks]]` uses a path that requires auth and you didn't send one, the check 401s and Fly might interpret that as failure — switch the check path or accept 401.

## After everything passes, app still shows empty data

Expected. A freshly-bootstrapped ledger has no contracts. Create one via your app's allocator/command path and verify it appears in `/ledger` or wherever you list contracts. If it doesn't:

- Your `liveQuery` is filtering by a party your runtime user doesn't have `CanReadAs` on. Add it to the grant list and re-run step 5.
- You created the contract acting as a party your runtime user doesn't have `CanActAs` on — Canton would have refused submission with `PERMISSION_DENIED` on the command, so check submission logs too.
- The filter compares the logical party name against a fully-qualified contract payload party — see "App lists are empty even though `getActiveContracts` returns rows" above.

## `dpm build` fails with `./.daml/package-database/2.2: getDirectoryContents:openDirStream: does not exist`

A partial `.daml/` build cache is checked into git (typically `package-database/metadata.json` advertising SDK 2.2, but no `2.2/` subdirectory). Locally `dpm` regenerates it; CI builders (Seaport, Fly remote build, GitHub Actions) inherit the broken cache and bail before compiling.

Fix:

```bash
rm -rf daml/.daml
```

Ensure `daml/.gitignore` contains `.daml/` so it can't get re-committed. Re-run the build; `dpm` will repopulate the package-db cleanly.
