# Improve mobile UX

Scope: presentation-only. No business logic, no server functions, no schema changes.

## Problems visible in the screenshot (/contracts/new at 384px)

1. Template cards clip badge text ("6 fiel…") — badge is `shrink-0` but card row uses plain flex without `min-w-0` on the title, so the badge is pushed off-screen instead of the title truncating.
2. The 3-column grid `md:grid-cols-[260px_minmax(0,1fr)_320px]` stacks correctly on mobile, but the template list renders 10 full-height cards before the form — user must scroll past everything to reach the form. Needs a collapsed picker on mobile.
3. Page title/description use desktop sizing; hero block eats a full viewport height on 384px.
4. Execution Log + Active Contracts panels sit at the very bottom on mobile; fine, but their `max-h-[320px]` inner scrolls trap touch scroll. Should relax on mobile.
5. `CreateContractForm` "Add Party" trigger uses `ml-auto` inside a wrapping flex — on narrow widths it jumps to its own line unpredictably. Row of party chips + trigger needs a stable mobile layout.
6. Hash-field preview line (`hash(amountGbp) = …`) is a single long mono string with no wrap → horizontal scroll on mobile.
7. Success toast shows full contract id inline (`font-mono`), also overflows.

## Changes

### `src/routes/contracts.new.tsx`
- Wrap the template list in a mobile-only `<details>` (native disclosure) that shows the currently-selected template as the summary and collapses the other 9 cards. On `md:` keep the always-open sidebar.
- Reduce hero: `text-2xl md:text-3xl` stays, but tighten top/bottom padding on mobile (`py-4 md:py-10`) and clamp description to 2 lines with `text-[13px] md:text-sm`.
- Inside each template card row: wrap title in `min-w-0 flex-1` and add `truncate` so the field-count badge stays visible.
- Relax panel scroll caps on mobile: `max-h-[60vh] md:max-h-[320px]`.
- Grid: keep 3-col on `md:`, but on mobile reorder to Form → Templates disclosure → Log/Active, so the primary action is above the fold.

### `src/components/contracts/CreateContractForm.tsx`
- actAs row: switch outer wrapper to `grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap` so chips wrap in the left cell and "Add Party" stays pinned right. Add `min-w-0` on chip container.
- Chip label: wrap in `truncate max-w-[10rem]` so long party ids don't push the ✕ off-screen.
- Hash preview box: add `break-all` and drop to `text-[10px] md:text-xs`.
- Success banner: render contract id on its own line with `break-all font-mono`.
- Field label row: badge uses `ml-auto shrink-0`; add `min-w-0` on the name span with `truncate` for long field names.

### `src/routes/index.tsx` (light touch, mobile only)
- The FAQ section added earlier: ensure question triggers use `text-left` and `min-w-0` so long questions wrap instead of pushing the chevron. Confirm the hero chip strip (`dl`) wraps to a 2-col grid on mobile (`grid-cols-2 sm:flex`).

## Out of scope
- No changes to templates registry, server functions, Daml, or routing.
- No new components or dependencies.
- Desktop layout unchanged except where a class also applies at `md:` (verified per-change).

## Verification
- `tsgo --noEmit`.
- Playwright at 384×800: screenshot `/contracts/new` before/after; confirm no horizontal scroll, badge visible, form reachable within one screen of scroll.
- Playwright at 1280×1800: confirm desktop layout unchanged.
