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

**Fixed, same root cause:** every other *reachable, user-facing* validation
`throw new Error(...)` across the codebase — duplicate email/last-admin guard
on users, required-name fields on boards/clients/categories/asset-categories/
KB/tickets/automation rules/canned responses, password length, schedule
end-before-start, SLA positive-minutes, branding logo size/type, attachment
file-size limits (staff + portal) — now returns `{ error }` and is read via
a new shared `components/ui/action-form.tsx` (the create/update counterpart
to `delete-button.tsx`), so the message shows inline with the form instead of
redirecting to the generic `app/error.tsx` crash page in production. See
`plan.md`'s "Return-value error handling for user-facing validation
(systemic pass)" entry for the full file list and what was deliberately left
as a throw (select-constrained values, races, and the asset-category custom
field-schema builder, which needs a bigger refactor of its own client
component to wire in). `tsc --noEmit` and `npm run build` both clean.
**Not verified:** no browser available to click through a real duplicate-email
or blank-name submission and confirm the inline banner + retained input.

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
  both clean.

- [x] **Assets are editable (including reassigning client/department) and
  categories can define custom fields.** See `plan.md`'s "Assets — client/
  department reassignment + per-category custom fields" entry for the full
  writeup — closes out the "not fully customizable fields" scope note above.

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

- [x] **Rich editing for the KB body and ticket description — now markdown, not
  WYSIWYG.** Originally shipped as a Tiptap WYSIWYG editor storing sanitized
  HTML; replaced with plain markdown per a later request (see `plan.md`'s
  "Markdown editing (replaces the Tiptap WYSIWYG editor)" entry for the full
  writeup). `components/ui/markdown-editor.tsx` (Write/Preview tabs + a
  formatting toolbar over a plain `<textarea>`) for KB article body
  (`app/kb/new`, `app/kb/[id]/edit`) and ticket description
  (`app/tickets/new`); `components/ui/markdown-content.tsx`
  (`react-markdown` + `remark-gfm` + `remark-breaks`) renders it everywhere —
  staff and portal KB views, staff and portal ticket detail views, and the
  editor's own Preview tab (one render path, not two). `KbArticle.body`/
  `Ticket.description` now store raw markdown source instead of sanitized
  HTML; the sanitization boundary moved from a write-time HTML allowlist
  (`lib/sanitize-html.ts`, now deleted) to render-time (no `rehype-raw`, plus
  `rehype-sanitize` restricting link/image URL schemes) — verified against
  script tags, `javascript:` links, and the real pre-existing seeded content
  (see `plan.md` for the specifics). `tsc --noEmit` and `npm run build` both
  clean. **Not verified:** no browser available — the editor's Write/Preview
  toggle, toolbar buttons, and a real save→render round trip all need a
  manual click-through.

- [x] **Dashboard redesign.** The original Claude Design project
  (`2c0ced40-c7a3-454a-8606-231613c330dd`, `LightPSA.dc.html`) is confirmed
  gone — `DesignSync.list_projects` no longer returns it and `get_project`
  against that id 404s directly, and the user confirmed they don't have a
  local copy either. Rebuilt `app/page.tsx` from scratch (no reference to
  recreate against, by the user's choice) rather than leaving it at 4 stat
  tiles + one table: added a 5th stat tile (**Unassigned** open tickets,
  amber-accented when > 0 — the previously-missing at-a-glance triage
  signal), a "Ticket volume — last 4 weeks" `ColumnChart` (same
  created-vs-resolved bucketing as Reports' 8-week version, but shorter —
  meant as a pulse check, not a duplicate of Reports' historical view), an
  "Open tickets by priority" `Bar` breakdown (finally wires up
  `components/ui/bar-chart.tsx`/`column-chart.tsx`, previously unused outside
  Reports), an "Upcoming visits" list (next 5 `ScheduledVisit` rows, a widget
  that didn't exist anywhere before), and a "Recently updated tickets" table
  (last 6 open tickets by `updatedAt`, for fast triage of what changed). Kept
  the existing "Open tickets by board" table as-is. `tsc --noEmit` and
  `npm run build` both clean — confirmed the route's First Load JS is
  unchanged (213 B / 106 kB) despite the added charts, since everything stays
  a Server Component (no new client-side state introduced). **Not verified:**
  no browser available — layout/spacing of the new grid and chart rendering
  haven't been visually confirmed.

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

- [x] **Permission-group RBAC system.** Built additive-only, per the user's
  explicit choice when asked (a group can only grant a capability on top of a
  role, never restrict ADMIN/MANAGER below what they already have). New
  `Permission` enum (11 values, one per real admin gate), `PermissionGroup` +
  `UserPermissionGroup` models (hand-written migration, same pattern as prior
  ones this session), `lib/rbac.ts`'s `requirePermission()`, and permissions
  threaded through the session/JWT and refetched on every request (not just
  at login). Admin UI at `/admin/permission-groups` (ADMIN-only) plus group
  assignment on the user edit page. Every other `requireRole(ADMIN, MANAGER)`
  / `requireRole(ADMIN)` call site across the app (~50, ~28 files) converted
  to the additive check, and nav/the `/admin` hub made permission-aware so a
  grant is actually reachable. See `plan.md`'s "Permission-group RBAC system"
  entry for the full file list, the exact permission catalog, and — the part
  worth reading before trusting this — a real privilege-escalation hole
  (`MANAGE_USERS` could mint/edit a full ADMIN account) that an advisor
  review caught before this was called done, and how it was closed. `tsc
  --noEmit` and `npm run build` both clean; group creation/assignment/
  permission-resolution/cascade-delete verified directly against the dev DB.
  **Not verified:** no browser available — the actual authorization decision
  (a permissioned technician reaching what they should, blocked from what
  they shouldn't) needs a real login to confirm, not just code review.

## MSP → single enterprise mode (needs its own implementation pass)

Decided shape, from a clarifying round with the user:

- [x] **Configurable, not a one-way migration.** Added `orgMode`
  (`OrgMode` enum: `MSP` | `ENTERPRISE`, default `MSP`) to the `Setting`
  singleton (migration `20260716040000_org_mode`, hand-written like the
  asset-categories one — `prisma migrate dev --create-only` errored on a
  stale checksum for that earlier hand-written migration when replaying
  against a shadow DB, so this one was authored directly and applied via
  `prisma migrate deploy`). `lib/settings.ts` exports `isEnterpriseMode()`,
  `getOrgLabels()`, and the underlying `orgLabels` map. Toggle lives on
  `/admin/branding` (radio-card UI next to company name/logo, not a separate
  `/admin/general` page) via `updateBranding`. The underlying
  `Client`/`Contact`/`Contract`/portal schema is untouched — only labels and
  visibility change.
- [x] **Client/Contact are relabeled in the UI, not renamed in the schema.**
  In enterprise mode `Client` → "Department"/"Departments" and `Contact` →
  "Employee"/"Employees" everywhere staff-facing: nav (`components/
  nav-shell.tsx`), dashboard stat tile, `/clients` list + detail + new-client
  form, ticket list/detail/new-ticket forms (including the hover-preview
  card, which needed a `clientLabel` prop threaded through since
  `tickets-table.tsx` is a client component and can't call the server-only
  label helper itself), automation rule list/builder, and the client
  delete-guard/validation error strings. No Prisma model or field was
  renamed.
- [x] **Client portal stays, repurposed as employee self-service.** Turned
  out to need almost no portal-page changes — the portal already read
  generically ("Welcome, {name}", "My Tickets"), with no hardcoded "Client"
  copy anywhere in `app/portal/*`. Only two visible strings actually said
  "client": the login screen's "Client Portal" tab (now "Employee Portal" in
  enterprise mode, threaded via a `portalTabLabel` prop since `login-form.tsx`
  is a client component rendered before any session exists) and the KB
  editor's "hidden from the client portal" checkbox hint.
- [x] **Billing/Contracts hidden entirely** in enterprise mode: `/billing`
  page and `/billing/export` CSV route both return 404/`notFound()`, the
  Billing card is filtered out of the `/admin` hub, the Contracts card on
  the client detail page is conditionally rendered, and — found during this
  pass, not in the original scope note — the Reports page's "Retainer
  consumption" card is also gated the same way, since it's billing/contract
  data.
- Verified live end-to-end against the dev server (port 3000) using a
  logged-in ADMIN session: submitted the `/admin/branding` toggle to
  `ENTERPRISE` and confirmed nav showed "Departments" with no Billing link,
  `/billing` 404'd, `/admin` hub had no Billing card, `/clients` read
  "Departments", and a client detail page showed "Employees" with no
  Contracts section — then toggled back to `MSP` and confirmed `/billing`
  (200, "Billing Review Queue") and `/clients` ("Clients") both reverted.
  `tsc --noEmit` and `npm run build` both clean throughout.
