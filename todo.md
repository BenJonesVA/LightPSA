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

- [ ] **Customizable asset categories.** `AssetType` is currently a fixed Prisma
  enum (WORKSTATION/LAPTOP/SERVER/NETWORK_DEVICE/PRINTER/MOBILE_DEVICE/OTHER).
  Making it admin-manageable means converting it to a real model, the same
  self-referential pattern as the `Category` admin work
  (`app/admin/categories/*`) — reuse that pattern directly.
  **Scope note:** this is different from, and much smaller than, fully
  "customizable fields" (arbitrary attributes per asset), which is a
  schema-less-data problem of its own. Recommend shipping category
  customization first and scoping free-form custom fields separately later.

## Larger (multi-file, real design work — each probably deserves its own planning pass)

- [ ] **Schedule Month / Day / Agenda views.** `app/schedule/page.tsx` currently
  only renders a Week view (with technician filter and week nav). Add a view
  switcher (`?view=week|month|day|agenda`) sharing the existing
  `scheduledVisit` query, with three new render branches for the date-range
  math and layout.

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

- [ ] **Hover-preview on ticket list rows.** New small client component,
  `setTimeout`-gated (1s delay) hover card showing a brief summary
  (status/priority/client/assignee) in `app/tickets/page.tsx`. The data's
  already in the list query — this is purely a UI/interaction addition.

- [ ] **Auto-refresh on the ticket detail screen.** Simplest approach: a tiny
  client component using `setInterval` + `router.refresh()`, mounted in
  `app/tickets/[id]/page.tsx`. Worth flagging up front: it should pause while
  a comment/time-log/expense form has focus, so it doesn't clobber
  in-progress typing.

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
