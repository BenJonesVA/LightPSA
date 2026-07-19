# Todo 2 — Ticketing gap-analysis backlog

Continuation of the ticketing-system gap analysis (see chat history / the
5-batch sequencing plan). Batch 1 (ticket custom fields, due dates, ticket
templates) is done — see the "SLA and Manual ticket assignment" +
subsequent commits for that plus the earlier manual-assignment/SLA-pause
quick wins.

**Batch 2 (this backlog) is now mostly built** — see commits `df88479`
through `a397ad6`. One schema migration (`df88479`) added every new model
the batch needed up front, so 9 parallel agents could build disjoint
feature slices without racing `prisma migrate`/schema.prisma edits, then
one more sequential pass (`a397ad6`) did per-client SLA once the shared
call-site files it touches had settled. `npx tsc --noEmit` and `npm run
build` both pass clean as of `a397ad6`.

**Not yet click-through verified in a real browser** — same caveat as
Batch 1's own follow-up below: the Chrome extension was disconnected all
session, so everything below was verified via `tsc`/`next build` plus
manual code tracing, not by driving the actual UI. Worth a pass before
trusting any of it in front of a real user.

## Follow-ups from Batch 1 itself

- **Not verified live.** The New Ticket form's combined template/category/
  custom-fields component (`components/ui/ticket-create-fields.tsx`) has
  only been verified at the server-logic level (a script exercised
  `parseFieldSchema`/`extractCustomFieldsFromFormData`/
  `validateCustomFieldValues` and the Prisma writes directly) — the actual
  click-through (picking a template and watching title/description/
  priority/category populate together, custom fields appearing/
  disappearing on category change) has never been driven in a browser
  because the Chrome extension was disconnected all session. Worth an
  explicit click-through before trusting it.
- **Custom-field `required` is only enforced on the staff New Ticket form.**
  Portal ticket creation (`app/portal/actions.ts`), inbound email
  (`app/api/inbound-email/route.ts`), and automation-created tickets never
  set a `categoryId` at creation, so they silently carry no custom fields —
  same limitation Assets already have. Fine for now, but if a required
  field ever needs to be *actually* mandatory regardless of entry path,
  this is the gap.
- **`lib/asset-fields.ts` is now used for both Assets and Tickets** despite
  every exported name being `Asset`-prefixed (`AssetFieldDef`,
  `AssetFieldType`, `ASSET_FIELD_TYPES`). Deliberately not renamed — doing
  so would've touched 8 files for a naming-only change — but if this file
  picks up a third consumer, or diverges (e.g. Tickets need a field type
  Assets don't), it's worth renaming to something generic then (e.g.
  `lib/custom-fields.ts`).

## Batch 2 — built

- **Per-client/contract SLA.** ✅ `ClientSlaPolicy` model (one row per
  client+priority). `lib/sla.ts`'s `resolveSlaPolicy`/
  `loadSlaPolicyResolver` check it before falling back to the global
  `SlaPolicy` row; all 6 call sites (`app/tickets/[id]/page.tsx`,
  `app/tickets/page.tsx`, `app/page.tsx`, `app/reports/page.tsx`,
  `app/reports/export/route.ts`, `app/api/cron/sla-breach-check/route.ts`)
  updated. No-override behavior traced to be identical to before. Admin UI:
  an "SLA overrides" card on `app/clients/[id]/page.tsx`.
- **Board/BoardMember RBAC.** ✅ Non-ADMIN/MANAGER users are scoped to
  boards they're a `BoardMember` of on both the ticket list
  (`app/tickets/page.tsx`) and the assignee picker
  (`app/tickets/[id]/page.tsx`) — falls back to unrestricted if the user
  has zero board memberships configured, so an unconfigured board doesn't
  become a dead end. Admin UI: a "Members" checkbox card on
  `app/boards/[id]/page.tsx` (`setBoardMembers` in `app/boards/actions.ts`),
  gated the same way as the rest of board management
  (`MANAGE_BOARDS`/ADMIN/MANAGER) — the board-side counterpart to
  `ClientMember`'s user-side UI below.
- **Client/Department RBAC (`ClientMember`, added after the original batch,
  not in the initial gap analysis).** ✅ Same shape as Board RBAC, one
  dimension over: which clients'/departments' tickets a tech can see and be
  assigned. AND-composes with board scoping (both apply if both are
  configured). This is what makes ENTERPRISE org mode's "Departments"
  actually usable — e.g. scoping HR's staff to only HR's tickets while
  IT's staff only see IT's — and is equally useful in MSP mode to restrict
  a tech to their assigned customers. Management UI: a per-user
  "Clients"/"Departments" checkbox card on `app/admin/users/[id]/page.tsx`.
- **Structured audit log.** ✅ `TicketAuditLog` model, written alongside
  (not instead of) the existing synthetic `TicketComment` audit trail in
  `updateTicketStatus`/`updateTicketPriority`/`assignTicket`. "History" card
  on the ticket detail page.
- **KB↔ticket linking.** ✅ `TicketKbArticle` join table (mirrors
  `TicketAsset`), "Linked articles" card on the ticket detail page.
- **Full-text search / saved views.** ✅ `q` param ILIKE search on
  title/description (`app/tickets/page.tsx`). `SavedTicketFilter` model +
  save/apply/delete UI.
- **Merge / link / watcher concepts.** Watcher and Link built; Merge itself
  deliberately NOT built (see Deferred below). ✅ `TicketWatcher` (watch/
  unwatch + watcher list). ✅ `TicketLink` (RELATED/DUPLICATE, both
  directions shown) via a "Linked tickets" card.
- **Richer bulk actions.** ✅ `bulkAssignTickets` + an "Assign to…" dropdown
  in the tickets-table bulk toolbar, alongside Status/Priority.
- **Dispatch conflict detection.** ✅ `createVisit`
  (`app/schedule/actions.ts`) checks for overlapping `ScheduledVisit`s for
  the same technician; warns with the conflicting visit(s) and requires a
  "Create anyway" checkbox to force through rather than hard-blocking.
- **In-app notifications.** ✅ `Notification` model, bell UI
  (`components/notification-bell.tsx`) polling every 20s (same pattern as
  `auto-refresh.tsx`), written at all 3 existing email-or-comment sites
  (`lib/csat.ts`, `lib/automation.ts`'s `SEND_EMAIL_NOTIFICATION`,
  `app/api/cron/sla-breach-check/route.ts`).
- **RMM/monitoring auto-ticketing.** ✅ `POST /api/integrations/monitoring`,
  `TicketSource.MONITORING`, generic `ApiKey` model (SHA-256 lookup hash,
  not bcrypt — it's a machine credential looked up by exact hash, not a
  login password). Admin UI: `app/admin/api-keys/` (ADMIN-only, no
  `Permission` bypass — same reasoning as Permission Groups, since this
  mints a credential capable of filing tickets via the API). Create shows
  the raw key exactly once via a `?newKey=` redirect param (only the hash
  is ever persisted) with an explicit "copy it now" banner; existing keys
  can be toggled active/inactive or deleted from the same page.
- **Invoice model.** ✅ `Invoice`/`InvoiceLineItem`, `app/invoices/**`
  (list/generate/detail), a "Generate invoice" entry point on
  `app/billing/page.tsx`. Rate resolution ladder (exact role+workType
  `ContractRate` → workType-only → role-only → contract-wide →
  `Contract.defaultHourlyRate` → unresolved/skipped) had to be designed
  from scratch — no dollar-amount-per-TimeLog logic existed anywhere
  before this. Nav link added (`components/nav-shell.tsx`, same
  `MANAGE_BILLING`-gated / hidden-in-Enterprise treatment as Billing).
- **Client resolution-confirm / reopen window.** ✅ Piggybacked on the
  existing CSAT close-email (`lib/csat.ts`) — a "Still having this issue?"
  link keyed by the `CsatResponse.id` token hits `GET
  /api/tickets/reopen?token=...` and reopens the ticket. Note: this is a
  state-mutating `GET` (matches the existing `/csat/{id}` pattern) — a
  link-prefetcher (e.g. Outlook SafeLinks) could in theory trigger it
  early; not addressed, flagging in case it matters later.
- **Bidirectional asset↔ticket view.** ✅ Already existed on
  `app/assets/[id]/page.tsx` by the time this batch got to it (built in an
  earlier session) — just added the missing `PriorityBadge` next to the
  existing `StatusBadge` for consistency with `tickets-table.tsx`.
- **Report breakdowns/export.** ✅ Per-agent leaderboard, ticket-volume-by-
  category breakdown, and `GET /reports/export` CSV (mirrors
  `billing/export/route.ts`'s pattern) on `app/reports/page.tsx`.
- **Inline images in comments/descriptions.** ✅ `rehype-sanitize`'s schema
  now explicitly allows `<img src>` restricted to the `/api/attachments/`
  path prefix (it was otherwise open to arbitrary external URLs — an SSRF/
  tracking-pixel risk given the client portal — so this is a fix, not just
  a feature add). Editor toolbar gained an "Insert image" button; since the
  editor doesn't currently receive any ticket-scoped attachment list via
  props, it inserts a `![alt text](url)` placeholder for manual fill-in
  rather than a picker — wiring an actual attachment picker is a small
  follow-up (thread a `ticketId`/attachment-list prop into
  `MarkdownEditor`'s callers).
- **Attachment delete/versioning.** ✅ `deleteAttachment` action +
  `lib/storage.ts`'s `deleteAttachmentFile`, delete button on each
  attachment. Versioning not built (wasn't asked for, still not worth it
  per the original note).

## Deferred — needs a scoping decision, not a mechanical build

These were deliberately NOT built in Batch 2, even though "proceed with
everything" was the instruction — the original gap analysis flagged each
of these as needing its own conversation about shape/semantics before
writing code, and guessing wrong here is expensive to unwind:

- **Per-ticket permission gating.** Still just `requireStaff()` on every
  mutation in `app/tickets/actions.ts`. Needs a decision on new
  `Permission` values (e.g. `VIEW_INTERNAL_NOTES`/`REASSIGN_TICKETS`) vs.
  folding into the Board RBAC now in place.
- **ITIL taxonomy / problem management.** No `TicketType`/`Problem` model.
  Called out as "the single biggest data-model change in the whole
  backlog" — still true.
- **Ticket merge.** `TicketLink`/`TicketWatcher` are built (see above), but
  merge itself (does the merged-away ticket get `status: CLOSED` +
  `mergedIntoId`? do comments/time logs move or just get a marker comment?)
  needs its own design pass before coding — semantics weren't guessed.
- **Inbound-email hardening.** `app/api/inbound-email/route.ts` still files
  a ticket from any sender with no loop protection, spam throttling, or
  review queue. Needs a decision: rate-limit per sender? require a known
  `Contact.email` match? a `PENDING_REVIEW` status for unknown senders?
- **Business-hours/holiday SLA calendar.** `lib/sla.ts` still computes
  against raw elapsed minutes (plus the WAITING_ON_CLIENT pause, plus the
  new per-client override) — no "9-5 Mon-Fri" or holiday awareness. Flagged
  as genuinely fiddly date math (crossing midnight/weekends/holidays/DST)
  that deserves dedicated, budgeted time with real edge-case tests, not a
  bolt-on inside a large parallel batch.
- **Data retention/archival policy.** No cron trims old CLOSED tickets/
  attachments. Lowest priority in the whole document — only worth it once
  data volume is actually a problem.

## Batch-2 process notes (for whoever reads this next)

- Built via 9 parallel agents on disjoint file sets (one owning
  `app/tickets/actions.ts` + `[id]/page.tsx`, one owning the ticket list,
  one per isolated feature) plus one schema-only pass up front and one
  sequential SLA pass after. Several agents' concurrent `git commit`s
  raced on the shared index — a few commit messages don't precisely match
  their contents (e.g. `f965d79`'s message only describes the asset-page
  change but its diff also contains the ticket-detail bundle), and one
  commit (invoices) landed staged-but-uncommitted and had to be committed
  separately afterward. Verified via `git diff`/`git show --stat` against
  every agent's own report, a full `npx tsc --noEmit`, and a full `npm run
  build` that nothing was lost or silently overwritten — the noise is
  cosmetic (attribution/message mismatch), not a correctness problem.
