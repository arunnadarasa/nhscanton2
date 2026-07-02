## Scope
Frontend/presentation only. File: `src/routes/index.tsx` (+ possibly `src/styles.css` for a new `.faq` accent). No business logic, no data model changes.

## 1. UI polish (existing sections)
- Hero: tighten headline rhythm, add a subtle secondary metric row (contracts on-ledger, ICBs, trusts) beneath the CTA row as a slim chip strip.
- KPI strip: add a tiny sparkline / delta indicator on the deficit stat; unify icon accent per stat.
- Cards: slightly stronger hover elevation, consistent `rounded-3xl`, add a section eyebrow ("The numbers", "The flow") above chart clusters to match the existing "The technology" pattern.
- Sources: convert to two-column card grid with hover chevron (keeps external links, just better visual weight).
- Small: fix minor spacing inconsistencies (mt-8 → mt-12 between major sections for breathing room).

## 2. New FAQ section (added before Sources)
Accordion-based, using existing shadcn `@/components/ui/accordion`. Section header matches the "Why Canton" eyebrow/title pattern.

Questions (concise, NHS/Canton-focused):
1. What is this app? — one-paragraph summary of the DHSC → NHSE → ICB → Trust flow on Canton.
2. Is this real NHS money? — no; demo using published NHS budget figures, settled with mock-USDCx (not real USDC.x) on Canton.
3. Who can see what? — privacy-by-template explanation; auditor read-only.
4. What is Canton and why not Ethereum? — link to `/canton-vs-evm`.
5. How does settlement work? — atomic `SettleAndCountersign` DvP with mock-USDCx.
6. Can I run this against a real Canton participant? — yes, three env vars; link to `/deploy`.
7. Where does the data come from? — NHS England, King's Fund, Nuffield Trust (link to sources section).

Layout: single-column accordion inside a `Card`-styled container, max width contained; consistent with existing card styles.

## 3. Metadata
No change to route head — title/description already accurate.

## Out of scope
- No changes to other routes, contracts, server functions, or Daml.
- No new dependencies (accordion already present).
