## Scope

Apply Rohith's Discord feedback: swap the three original NHS templates for their Privacy variants everywhere in the frontend, and expose the remaining templates from `daml/NhsTokenisedBudgetAllocation.daml` (`TokenisationRequest`, `NhsFundingToken`, `TokenRedemption`, `PrivateSettlement`, `ProofOfAmount`, `ProofOfSupplier`) in the Create Contract UI plus the audit/ledger views. Invoice stays as-is (not in the Privacy set).

## Template registry changes (`src/lib/canton/templates.ts`, `types.ts`, `contracts.functions.ts`, `memory.server.ts`)

Replace the current four `Nhs:*` IDs with a broader union that uses the `NhsTokenisedBudgetAllocation` module for the privacy flow:

- `NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy` — allocator/recipient/fiscalYear/amountGbp/purpose + `purposeHash` (auto-derive from `purpose` if blank).
- `NhsTokenisedBudgetAllocation:SpendCommitmentPrivacy` — trust/commissioner/auditor/category/amountGbp/period/supplier?, plus `amountCommit`, `supplierCommit?`, `paymentAmount?`.
- `NhsTokenisedBudgetAllocation:ReconciledSpendPrivacy` — read-only surface in audit/ledger views (still creatable for demo parity).
- `NhsTokenisedBudgetAllocation:TokenisationRequest` — allocator/recipient/fiscalYear/amountGbp/tokenId. Exposes `MintToken` choice.
- `NhsTokenisedBudgetAllocation:NhsFundingToken` — issuer/owner/tokenId/fiscalYear/amountGbp; `TransferToken` / `BurnToken` choices surfaced in the ledger row menu.
- `NhsTokenisedBudgetAllocation:TokenRedemption` — owner/issuer/tokenId/amountGbp.
- `NhsTokenisedBudgetAllocation:PrivateSettlement` — trust/commissioner/auditor/tokenId/amountCommit/purposeCommit/settlementRef?.
- `NhsTokenisedBudgetAllocation:ProofOfAmount` — commitmentCid/preImage/hashValue/verifier.
- `NhsTokenisedBudgetAllocation:ProofOfSupplier` — commitmentCid/preImage/hashValue/verifier.

Keep `Nhs:Invoice` in the registry (parallel invoice workflow untouched). Remove the three replaced originals (`Nhs:BudgetAllocation`, `Nhs:SpendCommitment`, `Nhs:ReconciledSpend`) from the union, Zod enum, memory-mode default seed list, and any hardcoded references.

Add a new `TemplateField` kind `"hash"` that auto-computes `hashText(source)` client-side (identity for now — mirrors the Daml implementation) so users don't type commitments manually.

## Server plumbing

- `client.server.ts` — swap the three helpers (`createAllocation`, `createSpend`, `createReconciled`) to target the Privacy variants; keep function signatures so callers don't change. Auto-derive `purposeHash` / `amountCommit` / `supplierCommit` inside the helpers.
- `live.server.ts` — `v2TemplateId` already prepends `#nhs-budget-app-v2:`; new IDs already contain the module. Update the `SettleAndCountersign` path to exercise on `SpendCommitmentPrivacy.CountersignPrivacy` (no atomic USDCx settlement on the Privacy variant per current Daml — instead expose a separate `PrivateSettlement` create flow).
- `memory.server.ts` — seed a couple of `BudgetAllocationPrivacy` + `SpendCommitmentPrivacy` rows so Memo mode still renders the ledger cockpit.
- `types.ts` — extend `TemplateName` union; add DTOs for the seven new templates.

## Route / UI updates

- `allocations.tsx` — copy references `Nhs:BudgetAllocation` → `NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy`; add a “Tokenise this allocation” action that opens a modal to create a `TokenisationRequest`, and a "Reveal purpose" affordance (calls `RevealPurpose` choice via a new server fn) shown to the allocator only.
- `trust.$trustId.tsx` — spend commitment form posts to the Privacy variant; add a "Generate proof" panel that creates `ProofOfAmount` / `ProofOfSupplier` against a selected commitment.
- `icb.$icbCode.tsx` — countersign action now calls `CountersignPrivacy`; ledger listing switched to `ReconciledSpendPrivacy`.
- `audit.tsx` — list `ReconciledSpendPrivacy` and `PrivateSettlement`; each row exposes "Verify amount" / "Verify purpose" buttons that exercise the nonconsuming verify choices and surface the boolean result.
- `contracts.new.tsx` — dropdown now shows the eight new templates + `Invoice`. Group them under headings: **Privacy flow**, **Tokenisation**, **Proofs**.
- `ledger.tsx` — add "Tokens" and "Proofs" tabs alongside existing views; render `NhsFundingToken` with Transfer/Burn actions and `TokenRedemption` cards.
- Copy updates across `how-it-works.tsx`, `deck.tsx`, `AppShell.tsx` FAQ block on index — mention the Privacy templates and token flow.

## Choice-exercising server function (new)

Add `exerciseChoice` in `contracts.functions.ts` (server fn) that accepts `{ templateId, contractId, choice, argument, actAs }` and routes to a new `liveExercise` in `live.server.ts` (POSTs `/v2/commands/submit-and-wait-for-transaction` with `ExerciseCommand`). Needed by:
- `MintToken`, `TransferToken`, `BurnToken`
- `CountersignPrivacy`
- `RevealPurpose`, `VerifyAmount`, `VerifyAmountProof`, `VerifySupplierProof`, `VerifyPurpose`, `VerifySettlement`, `Redeem`

Memo-mode fallback for `exerciseChoice`: mutate `memory.server.ts` state to archive the source contract and create the child contract for the atomic choices, and return the boolean directly for the `Verify*` choices.

## Daml / DAR

No `.daml` file changes — all new templates already exist in `daml/NhsTokenisedBudgetAllocation.daml` and are built into the same `nhs-budget-app-v2` DAR. Bootstrap route will re-upload on next deploy (existing behaviour).

## Out of scope

- Invoice → ReconciledSpend flow (untouched).
- MockUsdcx atomic settlement (no Privacy variant of `SettleAndCountersign` in the Daml; PrivateSettlement is a separate contract, not a token transfer).
- No changes to auth, deploy, or connector wiring.

## Verification

- `tsgo` typecheck.
- Memo mode: create BudgetAllocationPrivacy → SubAllocatePrivacy → SpendCommitmentPrivacy → CountersignPrivacy → ReconciledSpendPrivacy visible to auditor.
- Memo mode: TokenisationRequest → MintToken → TransferToken → BurnToken cycle in `ledger.tsx`.
- Memo mode: ProofOfAmount + VerifyAmountProof returns `true`.
