# Update docs for Seaport Devnet + Encode Hackathon path

## Context
We now have working Devnet access via the **Encode Hackathon** and a **Seaport-managed 5N Sandbox validator** (OIDC client_credentials auth). The self-hosted Fly.io path was working end-to-end but is **paused** — no longer the recommended default because Devnet is available and requires zero infra ops.

## Files to change

### 1. `docs/canton-deploy/LEARNINGS.md`
- Add a new top-level section: **"Encode Hackathon → Seaport Devnet shortcut"**
- Explain: Encode provided hackathon participants with pre-provisioned Seaport Devnet access (OIDC token endpoint, runtime + bootstrap client credentials, 5N Sandbox validator)
- Note: Fly.io path is paused — it works, but not needed when Devnet is available
- Capture the new learning: OIDC `client_credentials` flow vs RS256 self-minted JWTs; decoding runtime token `sub` to derive the Canton ledger user id (critical fix for 403 "security-sensitive" errors on Devnet)
- Update the "What I'd do differently next time" list to mention trying Devnet first before self-hosting

### 2. `docs/canton-deploy/README.md`
- Update the decision tree to prioritize Seaport Devnet at the top:
  ```
  Need a participant reachable from Lovable?
  ├── Have Encode Hackathon / Seaport access? → Use Devnet (08-network-toggle.md, OIDC)
  ├── Fastest persistent self-hosted?         → 07-sandbox-bootstrap.md (Fly.io, paused)
  ...
  ```
- Add the Seaport/Devnet secrets to the secrets table:
  `CANTON_DEVNET_OIDC_TOKEN_URL`, `CANTON_DEVNET_OIDC_AUDIENCE`, `CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID/SECRET`, `CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID/SECRET`
- Note Fly.io path as "working but paused"

### 3. `src/routes/how-it-works.tsx`
- Update **MEGA_PROMPT** (~80 lines at top of file):
  - Replace Fly.io-centric wording with "Seaport Devnet via Encode Hackathon" as the primary path
  - Keep Fly.io as an optional self-hosted fallback, marked "paused / advanced"
  - Update secrets list to include OIDC devnet vars alongside legacy Fly vars
  - Add a note about deriving the ledger user id from the OIDC token `sub` claim (the 403 fix)
  - Keep the mode-flip logic (memory / localnet / devnet) and the 3-way toggle
- Update the **page body**:
  - Reorder the "Stack at a glance" card: Seaport Devnet first, Fly.io second (marked "paused")
  - Update the "End-to-end in 5 steps" section to describe the Devnet path (get OIDC creds from Encode/Seaport → set secrets → toggle to Seaport → Deploy → done)
  - Update "Taking it to MainNet" to mention that Devnet is the current staging ground
  - Update links

### 4. `docs/canton-deploy/08-network-toggle.md`
- Minor refresh: clarify that `devnet` (Seaport) is the currently recommended network for hackathon participants
- Add a note that `localnet` (Fly.io) is paused but the code remains functional

## Out of scope
- No code logic changes (mode.server.ts, oidc-token.server.ts, etc. already work)
- No deletion of Fly.io docs or scripts (just demote them in narrative)
- No UI component changes beyond text/copy in how-it-works.tsx