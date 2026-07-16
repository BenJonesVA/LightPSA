# Todo

Backlog from a product review of the admin panel work (see `plan.md` for that
build). Each item names the files/models involved today and what already
exists to reuse, so a future session can start without re-discovering
context. Grouped by rough size — quick wins first, biggest/least-scoped last.

## Bug fixed post-review: delete crashed in production

Reported: clicking "Delete board" on a board with tickets crashed to a blank
"Application error… Digest: XXXX" screen instead of showing the guard
message. Root cause: `deleteBoard`/`deleteUser`/`deleteClient` all threw a
plain `Error` for their expected/guarded failure case (board still has
tickets, user has history, etc.) — Next.js redacts a thrown Error's
`.message` in production builds, and this app has no error boundary, so the
guarded failure rendered as a total crash instead of the intended message.

Fixed by converting all three delete actions to *return* `{ error: string }`
instead of throwing (redaction only applies to thrown errors, not normal
return values), read client-side via a new shared `useActionState`-based
`components/ui/delete-button.tsx`. Also added `app/error.tsx` as a safety net
for anything else that still throws. Verified directly against the rebuilt
production docker deployment (port 3131, not just dev): all three
previously-500-crashing guarded deletes now return 200 with the record
preserved; the success (empty/no-history) delete path still works.

**Not yet fixed, same root cause:** every other validation `throw new
Error(...)` in this codebase (`createBoard`, `updateBoard`, `createClient`,
`updateClient`, `createUser`, `updateUser`'s last-admin guard, category/
canned-response/branding validation, etc.) has the identical latent bug —
just less likely to be hit than a delete guard, since real data usually
already exists. Worth a systemic pass converting the common ones to the same
return-value + `useActionState` pattern, prioritized by how likely each is to
actually fire in normal use (the last-admin guard on `updateUser` is probably
next most likely).

## Quick wins

- [x] **Delete boards.** Added `deleteBoard` in `app/boards/actions.ts` +
  delete button on `app/boards/[id]/page.tsx`. Verified live: deleting an
  empty throwaway board succeeds; deleting a board with tickets is blocked
  with "Cannot delete a board that still has tickets — deactivate it instead."

- [x] **Delete users.** Added `deleteUser` in `app/admin/users/actions.ts`
  (ADMIN-only, with the same last-admin-lockout guard as `updateUser`) +
  delete button on the user edit page. Verified live: deleting a fresh
  no-history user succeeds; deleting a user with time-log history is blocked
  with a clear "deactivate the account instead" error.

- [x] **Fix the "Link" button on ticket assets rendering outside its card.**
  Root cause: the `<select className="flex-1 ...">` had no `min-w-0`, so in a
  non-wrapping flex row inside the fixed 296px properties rail, the select's
  intrinsic content width (driven by asset-name option text) couldn't shrink,
  pushing the Link button past the card edge. Added `min-w-0` alongside
  `flex-1`. (Fixed from markup reasoning, not a visual browser repro — no
  browser tool was available this session; worth a visual sanity check.)

- [x] **Schedule-from-ticket should preselect the ticket.** Fixed the real gap:
  `app/schedule/new/page.tsx` now always includes the linked-in ticket in the
  dropdown query (`OR: [{status: open}, {id: preselectedId}]`) even if it's
  RESOLVED/CLOSED. Verified live: `/schedule/new?ticketId=8` (a RESOLVED
  ticket) now renders that ticket in the list, preselected.

## Medium (one feature area, schema + UI)

- [x] **Client archive/delete.** Added `updateClient`/`deleteClient` in
  `app/clients/actions.ts` + an edit form and delete button on
  `app/clients/[id]/page.tsx`. Guarded the same way as boards/users (blocked
  by existing tickets/contracts). Typechecked; not separately re-verified live
  beyond the agent's own typecheck pass (see below).

- [x] **Gate the Expenses card behind a checkbox.** Added
  `Ticket.expensesEnabled Boolean @default(false)` (migration
  `20260716021907_add_ticket_expenses_enabled`), a checkbox on the ticket
  creation form, a toggle on the ticket detail Properties card
  (`toggleExpensesEnabled`), and gated the Expenses `Card` on
  `expensesEnabled || expenses.length > 0` (so existing seeded expense data
  never silently disappears). Verified live: a new ticket created with the
  box checked shows the card; existing tickets 2/3 (which already had expense
  rows from seed data, flag defaulted false) still show it via the OR
  condition; a plain ticket with neither shows no Expenses card at all.

- [x] **Timer start/stop button for time logging.** Added `startTimer`/
  `stopTimer` to `app/tickets/actions.ts` (a "running timer" is just a
  `TimeLog` row with `endTime: null`, no schema change) and a
  `TimerControl` client component (`app/tickets/[id]/timer-control.tsx`) with
  a live-ticking elapsed-time display next to the Time Logs card header.
  Verified: renders correctly ("Start timer" button present, no open timer
  for the test session). **Caveat:** the start/stop actions themselves are
  wrapped in inline `"use server"` closures (matching this file's existing
  convention for all its other actions), which made them impractical to
  invoke via raw curl for a full HTTP-level test this session (no browser
  tool available) — verified via clean typecheck + code review against the
  same patterns as the already-working `logTime`/`logExpense`, not a live
  start→stop round-trip. Worth clicking through manually once.

- [x] **Audit-log priority/severity changes.** `updateTicketStatus` and
  `updateTicketPriority` in `app/tickets/actions.ts` now create an internal
  `TicketComment` ("Status changed from X to Y by {name}.") whenever the
  value actually changes, using the acting user from `requireStaff()`. Same
  curl-verification caveat as the timer above (inline closure actions) —
  verified via typecheck + code review, not a live click-through.

- [x] **Assets get their own section.** New `app/assets/page.tsx` (list,
  all clients) + `{ href: "/assets", label: "Assets" }` in
  `components/nav-shell.tsx`. Verified live: `/assets` returns 200 and lists
  real asset rows linking to their detail pages.

- [x] **Asset detail view showing all tickets for that asset.** New
  `app/assets/[id]/page.tsx`. Verified live: fetched a real asset's detail
  page and confirmed it lists its linked tickets (TKT-15, TKT-6 for the asset
  tested) with working links.

- [x] **Mass-edit tickets from the ticket list.** (Added mid-review.) Extracted
  the table into a new client component (`app/tickets/tickets-table.tsx`) with
  a checkbox column, "select all" header checkbox, and a bulk-action bar
  (Set status / Set priority, each defaulting to "No change") that appears
  once ≥1 row is selected. Added `bulkUpdateTickets(ticketIds, formData)` in
  `app/tickets/actions.ts` — deliberately loops and calls the existing
  `updateTicketStatus`/`updateTicketPriority` per ticket rather than a raw
  `updateMany`, so resolvedAt/closedAt stamping, automation triggers, CSAT
  sends, and the new audit-log comment all stay correct for bulk changes too.
  Verified live: `/tickets` renders the new checkboxes for every row.
  **Caveat:** the actual bulk-apply round trip requires JavaScript (the bulk
  bar's form action is a client-side handler, not a plain server-action
  reference), so unlike most other items in this pass it has **no
  no-JS/curl-based fallback to test against at all** — this one specifically
  needs a manual click-through in a real browser to confirm end-to-end,
  more so than the timer/audit-log items above.

- [x] **Customizable asset categories.** Converted the fixed `AssetType` enum to
  a real `AssetCategory` model (self-referential, same hierarchy pattern as
  `Category`), with an admin page at `/admin/asset-categories` mirroring
  `app/admin/categories/*` exactly — including a guarded delete via
  `DeleteButton`/`useActionState` (a category with assets still assigned to
  it can't be hard-deleted, same FK-restrict pattern as boards/users/clients).
  Migration (`20260716030000_asset_categories`) was hand-written rather than
  autogenerated — `prisma migrate dev` refused to run non-interactively over
  a table with live data — and does the enum→model conversion in-place:
  creates `AssetCategory`, seeds one row per old enum value, backfills every
  existing `Asset.categoryId` from its old `type` column, then drops the
  column and the enum. Verified directly against dev Postgres: all 4 existing
  assets backfilled to the correct category, all 7 default categories seeded.
  Updated every call site that read `asset.type`
  (`app/assets/page.tsx`, `app/assets/[id]/page.tsx`, `app/tickets/[id]/page.tsx`,
  `app/clients/[id]/page.tsx`, `app/clients/actions.ts`, `prisma/seed.ts`) to
  the new `asset.category.name` relation. `tsc --noEmit` and `npm run build`
  both clean. **Scope note carried forward:** this is still just category
  customization, not fully "customizable fields" (arbitrary attributes per
  asset) — that remains a separate, later-scoped item.

## Larger (multi-file, real design work — each probably deserves its own planning pass)

- [x] **Schedule Month / Day / Agenda views.** `app/schedule/page.tsx` now has a
  `?view=week|month|day|agenda` switcher (default `week`, so old links keep
  working), one shared `scheduledVisit` query per visible range feeding all
  four render branches, and the technician filter carried through every view
  and every nav link. Month is a full calendar grid with dimmed adjacent-month
  days and a "+N more" link into Day view; Agenda pages 30 days at a time.
  Along the way, found and fixed a real timezone bug: `new Date(dateStr)`
  parses `YYYY-MM-DD` as UTC midnight, which lands on the previous local day
  in negative-offset timezones and silently breaks prev/next round-trips —
  added a `parseLocalDate()` helper and verified the fix with a
  `TZ=America/New_York` Node round-trip test. `tsc --noEmit` and `npm run
  build` both clean. **Not verified:** no browser available, so grid layout/
  spacing is logic-verified only, not visually confirmed.

- [ ] **WYSIWYG editor for the KB body and ticket description.** Both are plain
  `<textarea>` today (`app/kb/new/page.tsx`, `app/kb/[id]/edit/page.tsx`, and
  the ticket creation form). Needs a rich-text library — Tiptap recommended,
  it's headless and fits this repo's minimal-dependency style better than a
  bundled-UI editor. **Important:** these bodies currently render as trusted
  plain text (`whitespace-pre-wrap`, e.g. `app/tickets/[id]/page.tsx:153`).
  Switching to rendered HTML without sanitizing stored content on save and/or
  render is a stored-XSS hole — sanitization isn't optional polish here, it's
  required before this ships.

- [ ] **Dashboard redesign to match the original Claude Design mock.** `plan.md`
  references a Design project (`2c0ced40-c7a3-454a-8606-231613c330dd`, file
  `LightPSA.dc.html`) that was the source of the current token system and
  apparently had a fuller dashboard mock than what `app/page.tsx` renders
  today (currently just 4 stat tiles + one table). I tried pulling that
  project via the DesignSync tool and got a 404 — not accessible from this
  session/login. **Blocked on the user re-sharing access (or providing
  screenshots/the file)** before this can be implemented faithfully; "make it
  nicer" isn't specific enough to build against. Note:
  `components/ui/bar-chart.tsx` and `column-chart.tsx` exist but aren't used
  on the dashboard today — likely a sign the original mock had charts there
  that never got wired up.

- [x] **Hover-preview on ticket list rows.** Added to
  `app/tickets/tickets-table.tsx` (where row markup actually lives post the
  mass-edit refactor, not `page.tsx`): 1s `setTimeout`-gated hover card
  (status/priority/client/assignee, all already in `TicketRow` — no query
  change needed) that cancels on mouseleave/mousedown so quick pass-overs and
  clicks (checkbox toggle, row nav) never trigger or block on it; only one
  card visible at a time; `pointer-events-none` + fixed positioning so it can
  never intercept clicks. `tsc --noEmit` and `npm run build` both clean. **Not
  verified:** no browser available to confirm hover timing/positioning feels
  right in practice.

- [x] **Auto-refresh on the ticket detail screen.** New
  `app/tickets/[id]/auto-refresh.tsx`, mounted with a two-line change in
  `app/tickets/[id]/page.tsx` (same pattern as `timer-control.tsx`). Refreshes
  every 20s via `router.refresh()`; pauses (skips the tick, doesn't tear down
  the interval) while `document.activeElement` is inside a textarea/input/
  contentEditable, tracked via document-level `focusin`/`focusout` listeners
  cleaned up on unmount. `tsc --noEmit` and `npm run build` both clean. **Not
  verified:** no browser available to confirm the pause-on-focus behavior
  actually works across the comment/time-log/expense forms in practice.

- [ ] **Permission-group RBAC system.** The biggest item on this list besides
  enterprise mode below. Today `role` is a fixed 3-value enum
  (ADMIN/MANAGER/TECHNICIAN) checked via `requireRole(...)` sprinkled across
  nearly every page and server action (`lib/rbac.ts`). "Groups with specific
  permissions, managed at admin level" implies a new `PermissionGroup` model
  with granular flags (e.g. `canManageBilling`, `canManageUsers`,
  `canViewReports`, ...), a `User`↔`Group` many-to-many join, and touching
  every existing `requireRole` call site to also check group permissions.
  Recommend this stays **additive** to the existing role enum (groups grant
  extra permissions on top of role, rather than replacing the whole system in
  one flag-day rewrite), and recommend a **dedicated planning session** when
  ready to start — the exact permission catalog needs its own scoping pass,
  too large to spec correctly as one backlog bullet.

## MSP → single enterprise mode (needs its own implementation pass)

Decided shape, from a clarifying round with the user:

- [ ] **Configurable, not a one-way migration.** Add an `orgMode` field
  (`"MSP" | "ENTERPRISE"`, default `"MSP"`) to the `Setting` singleton
  (`lib/settings.ts`, `prisma/schema.prisma`), toggleable from the admin
  panel — the underlying `Client`/`Contract`/portal schema doesn't change,
  only what's shown.
- [ ] **Client/Contact are relabeled in the UI, not renamed in the schema.** In
  enterprise mode, `Client` reads as "Department" (or collapses to a single
  implicit org) and `Contact` reads as "Employee" — this is copy/conditional-
  nav work, not a Prisma model rename (a real schema rename would be a much
  bigger change for purely cosmetic value).
- [ ] **Client portal stays, repurposed as employee self-service** — not removed.
- [ ] **Billing/Contracts are hidden entirely** in enterprise mode: nav links,
  `/billing`, and the contract section of the client detail page all become
  conditional on `orgMode`.
- Touches: `components/nav-shell.tsx` (conditional nav), `lib/settings.ts` +
  schema migration, `app/admin/branding` or a new `/admin/general` settings
  page for the toggle, plus every page/copy string that currently says
  "Client"/"Contact"/"Billing" in a staff-facing (not raw data) context.
