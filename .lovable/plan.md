Rework the desktop top navigation in `src/components/AppShell.tsx` to match the "Enterprise hierarchical" direction. Mobile Sheet nav and NetworkToggle logic stay unchanged.

## Changes

**`src/components/AppShell.tsx` — desktop `<nav>` only**

Replace the flat row of 11 links with 3 hover-dropdown groups plus 2 primary actions. Layout stays the floating glass bar; only the middle nav slot changes.

Groups:
- **Cockpits** → Allocations, ICB cockpit, Trust view
- **Ledger** → Ledger, Audit, Create contract
- **About** → Why Canton, How it's built, Deploy, Hackathon, Pitch deck

Primary CTAs (always visible, right of the dropdowns, before the MEMO/DEVNET toggle):
- **Create contract** (secondary style)
- **Deploy** (primary filled)

Environment toggle (MEMO/DEVNET) and Sign in/out stay in their current right-side slot.

## Implementation notes (technical)

- Add a `NAV_GROUPS` constant with `{ label, items: [{ to, label, description? }] }`. Keep the existing flat `NAV_LINKS` array for the mobile Sheet so mobile behavior is unaffected.
- Build a small `NavGroup` component using pure Tailwind hover state (`group` + `group-hover:visible`) and a chevron from `lucide-react` that rotates 180° on hover — no new deps, no Radix menu needed.
- Dropdown panel: `absolute top-full left-0 mt-2 w-64 rounded-xl border border-border bg-white/95 backdrop-blur-xl shadow-lg p-2` with each item as a `<Link>` styled like the prototype (title + optional muted description).
- Add tiny buffer `pt-2` on the panel so cursor travel from trigger→panel doesn't lose hover.
- Ensure keyboard access: trigger is a `<button>` that toggles an `open` state on focus-within as a fallback, so tab navigation still reveals the group.
- Wrap the whole `<nav>` in `hidden md:flex items-center gap-1` and give it `min-w-0` so it doesn't force overflow.
- Add the two CTA buttons (`Create contract` link + `Deploy` link) between `<nav>` and the right-side toggle cluster. Use existing design tokens (`bg-primary text-primary-foreground` for Deploy, `border border-border bg-white/60` for Create contract).
- Import `ChevronDown` from `lucide-react`.
- No changes to routes, mode toggle, auth logic, or the mobile Sheet block.

## Out of scope

- No visual changes to the hero or body content.
- No color/token changes in `src/styles.css`.
- Mobile nav (Sheet) stays as-is with the flat link list.
