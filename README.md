# NHS Ledger on Canton Network

A privacy-enabled healthcare NHS budget allocation + reconciliation app with tokenized public-money flows built for
the Canton Foundation hackathon (Track 1: Private DeFi & Capital Markets, Track 2:  TradeFi, RWA & Tokenized Assets)

Targets **Canton 3.4 + JSON Ledger API v2**.

**Primary deployment target:** [Seaport Devnet](https://app.devnet.seaport.to) via the Encode Hackathon — a managed 5N Sandbox validator with zero infrastructure to run.  
**Local fallback:** [Canton Builder Tool](https://github.com/canton-network-devs/Canton-Builder-Tool) — one-command Splice LocalNet on your laptop.

## Architecture

```text
DHSC ──BudgetAllocation──▶ NHS England
                              │
                              ├─SubAllocate──▶ ICB::LDN ──▶ Trust::GSTT
                              │                                  │
                              │                                  └─SpendCommitment─▶ ICB::LDN
                              │                                                         │
                              │                                                Countersign
                              │                                                         ▼
                              │                                          ReconciledSpend (Trust + ICB signed,
                              │                                                           Auditor observer)
```

Optional **Supplier Settlement** leg: `SpendCommitment` and `Invoice` carry
`supplierName : Optional Text` as the human-readable payee label (kept on
the audit trail). When USDCx settlement is wired in, the `SettleAndCountersign`
choice takes a separate `supplierParty : Party` argument and atomically
transfers wrapped-USDC (USDCx, xReserve programme on Canton DevNet) to that
party *while* archiving into `ReconciledSpend` in a single transaction —
true DvP, both legs commit or both revert. The on-chain payee stays
distinct from the free-text label. Visit `/trust/<code>` to try it; see
`docs/canton-deploy/06-usdcx.md` for going live on DevNet.

Each arrow is a Daml contract on a Canton participant. Canton enforces that:

- `Trust::GSTT` spend lines are invisible to `Trust::MFT`, other ICBs, and the public.
- `Auditor` (National Audit Office) only sees `ReconciledSpend` once both sides sign.
- DHSC sees its top-level allocations but not how an ICB redistributes its envelope.

Live on [Seaport Devnet](https://app.devnet.seaport.to). 7 NHS Trusts are
funded with 200,000,000.00 mock-USDCx each (issuer = Auditor), ready to be
spent end-to-end through the `SettleAndCountersign` DvP choice.

## What Our App Does

The NHS Ledger enables transparent and auditable healthcare funding management on the Canton Network.

- DHSC allocates budgets to NHS England using `BudgetAllocation`
- NHS England distributes funding to Integrated Care Boards (ICBs) through `SubAllocate`
- ICBs further allocate funding to NHS Trusts
- NHS Trusts create `SpendCommitment` records for healthcare expenditure
- Trusts also raise `Invoice` records for supplier-facing spend (parallel flow)
- ICB commissioners review and approve spending through `Countersign` / `CountersignInvoice`
- Approved expenditure is recorded as `ReconciledSpend`
- Auditors can observe reconciled spending for compliance and governance purposes

This App is enabled with SHA 256 Encryption and Security, All funding allocation, approval, and reconciliation processes are enforced by Daml smart contracts, providing an immutable and privacy-preserving audit trail from government budget allocation to NHS expenditure.

## Files

- `daml/Nhs.daml` — Daml templates (signatories, observers, choices).
- `daml/BudgetAllocationReview.daml` - Reviews and validates budget allocations before distribution.
- `CommitmentInspector.daml` - Inspects and verifies the integrity of spend commitments.
- `InvoiceAnalytics.daml` - Calculates invoice totals with VAT for financial analysis.
- `InvoiceRisk.daml` - Calculates the risk level of invoices based on approval and supplier verification.
- `NhsTokenisedBudgetAllocation.daml`- Daml templates (signatories, observers, choices). 
- `ReconciledSpendSummary.daml` - Generates a reconciliation summary of spending records.
- `SettlementReview.daml` - Reviews settlements to verify audit readiness.
- `daml/daml.yaml` — Daml SDK 3.4 project manifest (`dpm build`).
- `src/lib/canton/client.server.ts` — Live/memory adapter.
- `src/lib/canton/live.server.ts` — JSON Ledger API **v2** client (raw `fetch`).
- `src/lib/canton/memory.server.ts` — In-process ledger that obeys signatory/observer disclosure.
- `src/lib/nhs/canton.functions.ts` — TanStack Start server functions used by the UI.

## Running against a real Canton participant

1. Install [Daml SDK 3.4+](https://docs.canton.network/sdks-tools/sdks/daml-sdk)
   via `dpm` and compile the model:
   ```bash
   cd daml && dpm build
   # optional: typed TS bindings instead of string template IDs
   dpm codegen-js .daml/dist/nhs-budget-app-v2-1.0.1.dar -o ../src/lib/canton/generated
   ```
   (The legacy `daml` Assistant is deprecated in 3.4 and removed in 3.5.
   The package was renamed from `nhs-budget` to `nhs-budget-app-v2` to make
   a non-backwards-compatible schema change without hitting `KNOWN_PACKAGE_VERSION`.)

2. Stand up a Canton 3.4 participant. Recommended order:
   - **Seaport Devnet (recommended)** — managed 5N Sandbox validator on
     [Canton Network Devnet](https://app.devnet.seaport.to). Zero infra; provisioned
     via the Encode Hackathon. Uses OIDC `client_credentials` auth.
   - **[Canton Builder Tool](https://github.com/canton-network-devs/Canton-Builder-Tool)** —
     one-command Splice LocalNet (`canton builder start && canton builder deploy …`).
     Exposes the JSON Ledger API on `http://localhost:2975`. Fastest local path.
   - [`cn-quickstart`](https://github.com/digital-asset/cn-quickstart) — full
     reference stack with Keycloak, PQS indexer, sample backend/frontend.
   - Canton 3 LocalNet via raw `docker compose` — see
     [`docs/canton-deploy/01-localnet.md`](docs/canton-deploy/01-localnet.md).
   - Self-hosted participant (Fly.io / VM) — see
     [`docs/canton-deploy/03-fly-io.md`](docs/canton-deploy/03-fly-io.md).

3. Upload `.daml/dist/nhs-budget-app-v2-1.0.1.dar` via `POST /v2/dars` (or
   Canton Console).

4. Allocate the parties (`POST /v2/parties`): `DHSC`, `NHSEngland`,
   `ICB-<code>`, `Trust-<code>`, `Auditor`.

5. Create the ledger user and grant party rights via
   `POST /v2/users/{userId}/rights`.

6. Set secrets in Lovable (**Project Settings → Secrets**) and flip the network pill.

   **For Seaport Devnet (recommended):**
   - `CANTON_DEVNET_JSON_API_URL` — e.g. `https://<validator>.seaport.to`
   - `CANTON_DEVNET_OIDC_TOKEN_URL` — Authentik token endpoint
   - `CANTON_DEVNET_OIDC_AUDIENCE` — audience claim the validator expects
   - `CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID` / `_SECRET` — runtime user token
   - `CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID` / `_SECRET` — admin token (DAR upload, party alloc)

   **For LocalNet / self-hosted (Builder Tool, Docker, Fly.io):**
   - `CANTON_JSON_API_URL` — e.g. `http://localhost:2975` (Builder Tool) or `https://your-participant.fly.dev`
   - `CANTON_JWT` — Canton 3 audience-based bearer token
   - `CANTON_USER_ID` — ledger user id (default `lovable-nhs-app`)
   - `CANTON_PARTY_DHSC`, `CANTON_PARTY_NHSE`, `CANTON_PARTY_AUDITOR` — party IDs

   > **Devnet gotcha:** the validator enforces that `userId` in every command
   > matches the `sub` claim of the OIDC runtime token. The app decodes the token
   > server-side and uses that `sub` automatically — do not hardcode `CANTON_USER_ID`
   > for Devnet.

   Then click the **Seaport** (or **LocalNet** / **Fly**) pill in the app header
   to write the `canton_network` cookie. Every server function reads this cookie
   and resolves env vars from the matching namespace (`CANTON_DEVNET_*` or
   `CANTON_*` / `CANTON_FLY_*`).

The header pill flips from **SIMULATED LEDGER** to **LIVE CANTON**
automatically once the health check passes.

## Why we can't host Canton inside the Lovable preview

The preview runtime is Cloudflare Workers — no JVM, no Docker, no inbound
port binding. A Canton participant needs all three. So the app talks to an
external participant over JSON Ledger API v2 (using `fetch`, since the old
`@daml/ledger` v1 client is EOL). When no endpoint is configured, the app
falls back to an in-memory ledger that mimics Canton's privacy rules so the
demo always works end-to-end.

> The official [`@canton-network/wallet-sdk`](https://docs.canton.network/sdks-tools/sdks/wallet-sdk)
> is installed. A runtime check at the bottom of `/deploy` verifies it
> bundles + runs under workerd (offline SDK construction, Ed25519 key gen,
> fingerprinting — no participant required). A follow-up will swap the raw
> `fetch` calls in `live.server.ts` for the SDK's prepare-sign-submit flow.

## Health check

`GET /api/public/health` — returns ledger mode, network, and in live mode a
real probe of `GET /v2/state/ledger-end`.

## Smart Contract Architecture

## BudgetAllocation

Tracks the allocation of NHS funding between healthcare organizations, enabling transparent budget distribution from DHSC to NHS England, ICBs, and NHS Trusts.

### Visibility
- Allocator
- Recipient
- reviewer

### Data Model

| Field | Type | Description |
|---------|---------|-------------|
| allocator | Party | Organization allocating funds |
| recipient | Party | Organization receiving funds |
| fiscalYear | Text | Financial year of allocation |
| amountGbp | Decimal | Budget allocated (£) |
| purpose | Text | Purpose of the allocation |
| purposeHash | Commitment | Purpose hash |
| tokenId | Text | Unique identifier used to distinguish tokenisation request |
| amountCommit | Commitment |  Budget allocated (£) hash |
| reviewer | Party | Reviewing budget allocation | 

### Choice: SubAllocate

Allows a recipient to distribute part of its allocated budget to another organization.

| Parameter | Type | Description |
|------------|------|-------------|
| toParty | Party | Recipient of the sub-allocation |
| amount | Decimal | Amount to allocate |
| subPurpose | Text | Purpose of the allocation |
| subPurposeHash | Commitment | Commitment hash | 

### Business Rules
- Allocation amount must be greater than zero.
- Allocation amount cannot exceed the available budget.
- Creates a new BudgetAllocation contract.

---

## SpendCommitment

Represents a spending commitment made by an NHS Trust before approval and reconciliation.

### Visibility
- Trust
- Commissioner (ICB)
- auditor

### Data Model

| Field | Type | Description |
|---------|---------|-------------|
| trust | Party | NHS Trust creating the commitment |
| commissioner | Party | Responsible Integrated Care Board |
| auditor | Party | Auditor reviewing expenditure |
| category | Text | Spending category |
| amountGbp | Decimal | Amount committed (£) |
| period | Text | Reporting period |
| supplierName | Optional Text | Supplier label (human-readable; not an on-chain party) |
| paymentAmount | Optional Decimal | Settlement amount | 
| amountCommit | Commitment | Stores the commitment details for the requested budget amount |
| commitmentCid | Text | Stores Commitment ID

----


### Choice: Countersign

Allows the commissioner to review and approve the spending commitment.

### Outcome
- Creates a ReconciledSpend contract.
- Records commissioner approval.
- Produces an auditable spending record.

### Data model

| Field | Type | Description |
|---------|---------|-------------|
| CountersignPrivacy | ContractId ReconciledSpendPrivacy | Countersigns the reconciled spend and creates a ReconciledSpendPrivacy contract | 
| commissioner | trust, commissioner, auditor, category, amountGbp, amountCommit, period, supplier, supplierCommit, settlementTxId | Used to populate the fields of the newly created ReconciledSpendPrivacy contract |


---

## ReconciledSpend

Represents approved and reconciled expenditure following commissioner review.

### Visibility
- Trust
- Commissioner
- Auditor

### Data Model

| Field | Type | Description |
|---------|---------|-------------|
| trust | Party | NHS Trust |
| commissioner | Party | Approving ICB |
| auditor | Party | Auditor |
| category | Text | Spending category |
| amountGbp | Decimal | Approved expenditure (£) |
| amountCommit | Commitment | Approved expenditure (£) hash |
| period | Text | Reporting period |
| supplier | Party | Supplier |
| supplierCommit | Commitment | Supplier hash |
| settlementTxId | Optional Text | Settlement transaction reference |

### Purpose
- Maintains an immutable record of approved expenditure.
- Supports auditing and compliance processes.
- Provides a complete approval history for spending activities.

---

### Settlement

The Settlement record is used to finalize, verify, and approve a committed budget

### Visibility

- Trust
- Commissioner
- Auditor
- Verifier
- Reviewer

| Field | Type | Description |
|---------|---------|-------------|
| trust | Party | Budget recipient trust |
| commissioner | Party | Budget issuing authority |
| auditor | Party | Allocation audit party |
| tokenId | Text | Budget token identifier |
| amountCommit | Commitment | Committed budget amount |
| purposeCommit | Commitment | Committed budget purpose |
| settlementRef | Text | Settlement reference ID |
| commitmentCid | Text | Commitment contract ID |
| preImage | Text | Original committed value |
| hashValue | Commitment | Derived commitment hash |
| verifier | Party | Commitment verifier |
| settlementCid | Text | Settlement contract ID |
| reviewer | Party | Settlement review party |


---
## Invoice

Supplier-facing parallel to `SpendCommitment` — a Trust raises an invoice
record that the commissioner countersigns into a `ReconciledSpend`.

### Visibility
- Trust 
- Commissioner
- auditor

### Data Model

| Field | Type | Description |
|---------|---------|-------------|
| trust | Party | NHS Trust raising the invoice |
| commissioner | Party | Responsible Integrated Care Board |
| auditor | Party | Auditor (carried through on reconciliation) |
| invoiceRef | Text | Trust-side invoice reference |
| category | Text | Spending category |
| amountGbp | Decimal | Invoice amount (£) |
| period | Text | Reporting period |
| supplierName | Optional Text | Supplier label (human-readable; not an on-chain party) |

### Choice: CountersignInvoice

Controller: `commissioner`. Archives the `Invoice` and creates a
`ReconciledSpend` carrying the same `supplierName`, with `settlementTxId = None`.

---

## Lessons learned

Hard-won from getting NHS Ledger live on Canton:

- **Free text is `Optional Text`, never `Optional Party`.** Modelling a
  supplier label as a `Party` made every command target `UNKNOWN_INFORMEES`
  on Devnet. If both a human label and an on-chain payee are needed, use
  two fields: `supplierName : Optional Text` + `supplierParty : Party` (the
  latter passed as a choice argument when actually settling).
- **Two JWT subjects, two purposes.** `participant_admin` for node ops
  (DAR upload, party allocation). A separate runtime user for ledger
  commands — the validator enforces `userId == sub` of the runtime token.
- **Schema migrations: rename the package, not the version.** A
  non-backwards-compatible change to an installed template fails with
  `KNOWN_PACKAGE_VERSION`. Bump the package *name* in `daml.yaml`
  (e.g. `nhs-budget-app` → `nhs-budget-app-v2`), rebuild, and update
  every `#nhs-budget` reference in TypeScript.
- **Grant `CanActAs` on every allocated party — Auditor included.** The
  bootstrap route used to grant Auditor only `CanReadAs` because Auditor is
  a pure observer on the NHS templates. The moment we added mock-USDCx
  (where Auditor is the issuer/signatory), every mint returned an opaque
  `403 "security-sensitive error"` with no party id in the body. The rule:
  if any template the runtime user ever submits commands for has a party in
  its `actAs` set, that party needs `CanActAs` — no exceptions. The
  self-deploy route now grants `CanActAs` to every allocated party.
- **Per-request network override via cookie.** The mode selector reads the
  `canton_network` cookie before falling back to `CANTON_MODE`, so a single
  `curl` can target Devnet (`-H "Cookie: canton_network=seaport"`) without
  flipping production. Use this for one-off admin endpoints
  (`self-deploy`, `mint-mock-usdcx`) instead of toggling env vars globally.


## Sources

NHS budget figures: King's Fund, Nuffield Trust, IFS, House of Commons Library,
Health Foundation, NHS Confederation, NHS England, One NHS Finance.

## Full deploy guide

See [`docs/canton-deploy/README.md`](docs/canton-deploy/README.md) for a
Seaport Devnet / LocalNet / Docker / Fly.io decision tree, JWT setup, and DAR
upload steps — all updated for Canton 3.4.
