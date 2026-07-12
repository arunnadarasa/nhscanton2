Yes — the /hackathon page is now a bit out of sync with the actual build. The most obvious mismatch is the contract/template count, but a few other claims have also drifted. Here's what I'd refresh and why.

## What I found vs. what the page says

- **Templates**: The page says "Five Daml templates". The app now has 15 templates in `NhsTokenisedBudgetAllocation.daml` (privacy flow, tokenisation, proofs, settlement, audit, redemption), plus 4 original templates in `Nhs.daml`, 6 review/analytics templates, and 1 `MockUsdcx.Holding`. That is ~26 templates, not 5. Even if we only count the core workflow templates exposed on the curated pages, the number is closer to 8-10.
- **Generic contract UI**: `/contracts/new` exists and lets users create any of the 15 templates from a registry. The page doesn't mention it at all.
- **Deployment paths**: The page says "Four documented deployment paths: Seaport Devnet, LocalNet, Docker, and Fly.io." The deploy page still shows 4 tabs, but the Fly.io tab is marked "Paused" and the Seaport tab is the recommended path. The header toggle is Memory / Fly / Seaport. The wording could be tighter.
- **Demo checklist**: It lists `/allocations`, `/icb/LDN`, `/audit`, `/ledger`, `/deploy`, and `/`. It omits `/contracts/new` and `/trust/GSTT`, even though the track cards link to `/trust/GSTT`.
- **Submission checklist**: The public repo and video links are now correct, but the "Public repository" note could mention that the Daml source and deploy docs are in the repo.

## Proposed changes

All edits are confined to `src/routes/hackathon.tsx`.

### 1. Update the Technical execution criterion
Replace the outdated "Five Daml templates" claim with the real shape of the model:

- Mention the 15 templates in the tokenised/privacy module (allocations, tokenisation, proofs, settlement, audit, redemption).
- Note that the curated workflow pages sit on top of the original `Nhs.daml` templates plus the new `NhsTokenisedBudgetAllocation` package.
- Add a link to `/contracts/new` as evidence of the generic template form.
- Keep the JSON Ledger API v2, tri-mode adapter, and deployment-path claims, but clarify that Fly.io is "supported but paused as the default".

### 2. Update the demo checklist
Add the missing live screens:

- `/contracts/new` — create any Daml template from the registry.
- `/trust/GSTT` — Trust-level view of sub-allocations and spend commitments.

Keep the existing entries for `/allocations`, `/icb/LDN`, `/audit`, `/ledger`, `/deploy`, and `/`.

### 3. Tighten the track cards and SCOPE notes
- Track 2 (TradeFi/RWA) already mentions tokenized obligations and atomic reconciliation. Add a brief mention of the tokenisation path (`NhsFundingToken`, `TokenisationRequest`, `TokenRedemption`) if it fits the narrative.
- Track 1 (Private DeFi) already mentions observers. Add a mention of the proof templates (`ProofOfAmount`, `ProofOfSupplier`) as evidence of privacy-preserving audit primitives.
- Track 3 stays an "Honest miss" — no wallet/agent in the demo.

### 4. Update header badges and SCOPE bullets
- Remove or verify the "$7,000 prize pool" badge if it is stale. If it matches the Encode brief, keep it.
- In the SCOPE list, clarify that the app can run against Seaport Devnet, in-memory simulator, or Fly.io (paused), and that the default live mode is Seaport.

### 5. No code changes outside the page
This is a content-only refresh. No routing, server functions, or Daml changes are required.

## Expected outcome

The /hackathon page will accurately describe the current app: a larger Daml surface, a generic contract-creation UI, and the same three-track / four-criteria structure. Judges clicking through will not be surprised by a "Five templates" claim when the ledger explorer shows 15+ template types.