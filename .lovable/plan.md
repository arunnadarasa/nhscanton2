## Problem

On mobile (384px), the Create Contract form panel overflows the viewport to the right. Visible symptoms in the screenshot:

- Template header subtitle `NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy` runs off the right edge
- Field-kind badges are clipped (`Part…`, `Tex…`)
- The form card's right border is cut off the screen

Root cause: the parent grid `md:grid-cols-[260px_minmax(0,1fr)_320px]` has no explicit mobile track, so it defaults to `grid-cols-1` — but the form panel's children (long mono strings, non-wrapping subtitle) force intrinsic width larger than the viewport because the grid track has no `minmax(0, …)` clamp on mobile either. Combined with `break-all` missing on the template subtitle, the panel expands.

## Fix (UI only, mobile only)

### `src/routes/contracts.new.tsx`
- Add explicit `grid-cols-[minmax(0,1fr)]` on mobile so the single column can shrink: `grid gap-5 grid-cols-[minmax(0,1fr)] md:grid-cols-[260px_minmax(0,1fr)_320px]`
- Add `min-w-0` to the form panel wrapper (`order-1 … min-w-0`) and the Execution Log / Active Contracts wrapper so their contents can shrink

### `src/components/contracts/CreateContractForm.tsx`
- Template header card: add `min-w-0` to the card, `truncate` (or `break-all` for the mono subtitle) to `{tpl.module}:{tpl.label}` line, and `break-words` to the label
- Field label row (`<Label>`): wrap in a `min-w-0` container; the name span already has `truncate` but the row is a flex — ensure the flex parent has `min-w-0 flex-1` so the badge on the right stays inside the panel instead of being pushed off
- actAs container: already grid, but add `min-w-0` to be safe

### Verification
- `tsgo --noEmit`
- Playwright screenshot at 384×800 confirming: no horizontal scroll, template subtitle wraps or truncates within card, `Party`/`Text`/`Numeric`/`Commitment` badges fully visible on the right of each field label

No changes to desktop layout, business logic, routing, or server functions.
