Refresh the pitch deck at `src/routes/deck.tsx` so it reflects the app as it stands today. Content edits only — no deck framework, layout, or styling changes.

## Slides to update

### 1. `title` slide
- Keep the three chips but replace the third with a more accurate stack line: **"Track 2 · TradeFi / RWA"**, **"Daml 3.4 · 8 packages"**, **"Seaport Devnet · live"**.
- Update subtitle to: *"The £192bn NHS budget, reconciled on a privacy-enabled Canton ledger."* (matches the homepage hero copy.)

### 2. `problem` slide
- Bump the headline number from £180B/yr → **£192B/yr** to align with the rest of the app.

### 3. `how` slide (biggest update)
Replace the on-ledger / off-ledger card contents with today's stack:

- **On-ledger** — Daml 3.4, 8 packages:
  - `Nhs` · `NhsTokenisedBudgetAllocation`
  - `BudgetAllocationReview` · `CommitmentInspector`
  - `SettlementReview` · `ReconciledSpendSummary`
  - `InvoiceAnalytics` · `InvoiceRisk`
  - Footnote: *"27 templates grouped into Budget Allocation, Spend Commitment, Reconciled Spend, Settlement, Invoice."*
  - Add one line: *"SHA-256 commitments (`hashText = sha256`) computed identically in Daml and the frontend."*

- **Off-ledger** — keep TanStack Start / JSON Ledger API v2 / OIDC lines and add:
  - *"Generic Create-Contract UI driven by a template registry"* (`/contracts/new`)
  - *"Server functions with memory-mode fallback + persisted execution log"*
  - Footnote: *"Seaport Devnet (primary) · in-memory demo fallback"*

### 4. `demo` slide
Add a fifth deep link between Trust view and Audit trail:
- **"4. Create contract"** → `/contracts/new`
- Renumber Audit trail to **5**.
- Adjust the column so 5 links still fit (unchanged flex-col; only a new row).

### 5. `roadmap` slide — `Now` card
Refresh the "Now" milestone to the current reality:
- *"Live on Seaport Devnet — 8 Daml packages deployed, 27 contract templates wired to a generic Create-Contract UI, role-scoped cockpits for Trusts / ICBs / NAO auditor."*

### 6. `criteria` slide — Application of technology
Update to: *"Daml 3.4 (8 packages, 27 templates) on Canton Seaport Devnet, JSON Ledger API v2, SHA-256 commitment hashing, privacy by counterparty."*

## Out of scope

- No changes to the `Slide` primitive, navigation, print mode, or slide ordering.
- No new slides added or removed.
- No changes to icons or accent visuals.
