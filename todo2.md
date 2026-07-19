# Todo 2 — Ticketing gap-analysis backlog

Continuation of the ticketing-system gap analysis (see chat history / the
5-batch sequencing plan). Batch 1 (ticket custom fields, due dates, ticket
templates) is done — see the "SLA and Manual ticket assignment" +
subsequent commits for that plus the earlier manual-assignment/SLA-pause
quick wins. Everything below is still open. Grouped the same way it was
proposed: remaining 🔴 high-impact items first, then Batches 2-5, then the
🟢 minor/polish tier. Each item names the models/files involved today and
what pattern to reuse, so a future session doesn't have to re-derive it.

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

## Remaining 🔴 high-impact items (not yet built)

- **Per-client/contract SLA.** `SlaPolicy` (`prisma/schema.prisma`) is one
  row per `TicketPriority`, globally — no way to give a retainer client a
  tighter SLA than a T&M client gets. Would need either a `clientId`/
  `contractId` override table (`ClientSlaPolicy`?) that `lib/sla.ts`'s
  `getSlaStatus` checks before falling back to the global per-priority row,
  or fold it into `Contract` (`prisma/schema.prisma` — already has
  `ContractType`-specific fields per type). The lookup call sites are the
  same 5 places already touched for the WAITING_ON_CLIENT pause fix:
  `app/tickets/[id]/page.tsx`, `app/tickets/page.tsx`, `app/page.tsx`,
  `app/reports/page.tsx`, `app/api/cron/sla-breach-check/route.ts` — all
  currently do `prisma.slaPolicy.findUnique({ where: { priority } })` or
  `findMany()`, and would need to also resolve the ticket's client/contract.

- **Board/BoardMember RBAC actually enforced.** `BoardMember`
  (`prisma/schema.prisma`) exists and is populated (`app/boards/*`) but is
  never read anywhere outside the schema/seed — confirmed by grep. Any
  staff member sees/acts on every ticket regardless of board membership.
  Would need: (1) `app/tickets/page.tsx`'s ticket list query scoped to
  boards the current user is a member of (unless ADMIN, or unless they hold
  a bypass permission), (2) the assignee picker on
  `app/tickets/[id]/page.tsx` (added in the manual-assignment work)
  probably narrowed to board members instead of all active users, (3)
  decide what MANAGER/ADMIN should see (probably unrestricted, matching how
  `requirePermission`'s role-bypass already works elsewhere in `lib/rbac.ts`).

- **Per-ticket permission gating.** Every mutation in
  `app/tickets/actions.ts` only calls `requireStaff()` — no distinction for
  who can post/see internal notes, who can reassign, who can act on a given
  board's tickets. The `Permission`/`PermissionGroup` system
  (`prisma/schema.prisma`, `lib/rbac.ts`'s `requirePermission`) only
  currently gates admin-console features. Adding per-ticket-action
  permissions is a bigger design question (new `Permission` values like
  `VIEW_INTERNAL_NOTES`/`REASSIGN_TICKETS`? or fold into the Board RBAC
  item above?) — worth scoping as its own conversation before touching
  code, not a mechanical "add a few enum values."

- **RMM/monitoring auto-ticketing.** `TicketSource` enum
  (`prisma/schema.prisma`) is `EMAIL | PORTAL | MANUAL | PHONE` — no way for
  a monitoring tool to file a ticket. Would need a new inbound webhook
  endpoint (mirror `app/api/inbound-email/route.ts`'s secret-token pattern
  in `lib/cron-auth.ts`/the inbound-email token check), a new
  `TicketSource.MONITORING` (or generic `API`) value, and a decision on
  auth (per-integration API key stored where? no `Integration`/`ApiKey`
  model exists yet).

- **Inbound-email hardening.** `app/api/inbound-email/route.ts` /
  `lib/inbound-email.ts` will file a new ticket from any inbound email that
  doesn't match a known thread, from any sender, with no visible loop
  protection (an auto-reply replying to an auto-reply), spam throttling, or
  review queue for unrecognized senders. Needs scoping: rate-limit per
  sender? require the sender to match an existing `Contact.email`? a
  `PENDING_REVIEW` ticket status for unknown senders that a staff member
  has to approve into a real ticket?

## Batch 2 — Visibility & audit

- **Structured audit log.** Today "who changed what" is entirely synthetic
  internal `TicketComment` rows created inline in
  `app/tickets/actions.ts` (`updateTicketStatus`, `updateTicketPriority`,
  `assignTicket`) — search for the comment
  `// Audit trail: who changed it and from what` to see the pattern. A real
  fix: new `TicketAuditLog` model (ticketId, actorId, field, oldValue,
  newValue, createdAt) written alongside (not instead of — the comment
  thread UI still wants a human-readable line) each of those actions, plus
  a way to query "all priority changes this month" that the comment-thread
  approach can't do. Decide whether to also backfill history from existing
  synthetic comments (probably not worth parsing free text) or just start
  clean from the migration date.

- **KB↔ticket linking.** No join table exists between `Ticket` and
  `KbArticle` today — confirmed by grep, they only share the `Category`
  model. Add a `TicketKbArticle` join table (mirror `TicketAsset`'s exact
  shape in `prisma/schema.prisma`) plus a "Linked articles" card on
  `app/tickets/[id]/page.tsx` (mirror the existing Assets card's
  link/unlink form pattern exactly — `linkAsset`/`unlinkAsset` in
  `app/tickets/actions.ts` is the template). A "suggested articles" feature
  (matching by shared category) is a nice-to-have on top, not required for
  v1.

- **Full-text search / saved views.** `app/tickets/page.tsx`'s `where`
  clause currently only supports exact-match Status/Priority/Board/Client
  filters via query params — no text search on title/description/comments.
  Simplest v1: a `q` query param doing `title: { contains: q, mode:
  "insensitive" }` (Postgres ILIKE, no new infra) OR a proper
  `tsvector`/`GIN` index migration if search needs to cover description +
  comments too (bigger, needs a raw SQL migration since Prisma doesn't
  model `tsvector` natively). Saved views would need a new model
  (`SavedTicketFilter`: userId, name, query-params-as-JSON) — smaller,
  additive, no dependency on which search approach wins.

## Batch 3 — Relationships & bulk ops

- **Merge / link / watcher concepts.** None of these exist — confirmed by
  grep. Three separate small models:
  - `TicketWatcher` (ticketId, userId, unique pair) — a
    "notify-on-update" join table separate from `assigneeId`.
  - `TicketLink` (ticketId, linkedTicketId, type: `RELATED`|`DUPLICATE`) —
    self-referential-via-join-table on `Ticket`.
  - Merge is trickier: decide semantics (does the "merged-away" ticket get
    `status: CLOSED` + a `mergedIntoId` field on `Ticket`? do its comments/
    time logs move to the surviving ticket, or just get a "merged from
    TKT-X" marker comment?) — scope this as its own design pass before
    coding, don't wing the data-migration semantics.

- **Richer bulk actions.** `bulkUpdateTickets` (`app/tickets/actions.ts`)
  currently loops `updateTicketStatus`/`updateTicketPriority` per ticket —
  same pattern extends cleanly to bulk-assign (loop the new `assignTicket`
  from the manual-assignment work) once you decide the UI (an "Assign to…"
  dropdown in `tickets-table.tsx`'s existing bulk-action toolbar, same spot
  as the Status/Priority selects). Bulk merge depends on the Merge item
  above existing first.

- **Dispatch conflict detection.** `ScheduledVisit`
  (`prisma/schema.prisma`) has exactly one `technicianId` and no check for
  overlapping time ranges. Add a query in `app/schedule/actions.ts`'s
  `createVisit` that checks for any existing visit for the same
  `technicianId` with overlapping `[startTime, endTime)`, and either block
  or warn (probably warn-with-confirm rather than hard-block, since a
  dispatcher might deliberately double-book a quick call over a long
  on-site visit).

## Batch 4 — Bigger systemic changes

- **Business-hours/holiday calendar.** `lib/sla.ts` computes SLA due dates
  off raw elapsed minutes (even after the WAITING_ON_CLIENT pause fix) —
  no concept of "9-5 Mon-Fri" or holidays. Needs a `BusinessHoursPolicy`
  model (per-weekday open/close times) + a `Holiday` model (date, name),
  and `getSlaStatus`'s due-date math rewritten to walk forward
  business-minute-by-business-minute instead of flat elapsed time — this
  is a genuinely fiddly date-math problem (crossing midnight, weekends,
  holidays, DST), budget real time for edge cases and tests, don't treat
  it as a quick add-on.

- **ITIL taxonomy / problem management.** Currently only a flat
  self-referential `Category` model serves double duty for tickets and KB.
  Real ITIL support means: a `TicketType` distinction (Incident / Service
  Request / Problem / Change) — could be a new enum on `Ticket`, or a
  separate `Problem` model that many `Ticket`s link to
  (`Ticket.problemId?`) representing a root cause, plus a lightweight
  change-approval workflow (who can approve a `Change`-type ticket before
  it moves past a certain status — ties into the per-ticket permission
  gating item above). This is the single biggest data-model change in the
  whole backlog — treat it as its own scoping conversation, not something
  to bolt onto an existing batch.

- **In-app notifications.** No `Notification` model exists — every "push"
  today is a live email send via `lib/email.ts` (Resend), which silently
  degrades to "logged an internal comment saying it would have emailed"
  when unconfigured (see `lib/csat.ts`, `lib/automation.ts`'s
  `SEND_EMAIL_NOTIFICATION` action, and
  `app/api/cron/sla-breach-check/route.ts` for the three existing
  email-or-comment call sites — a notification model would likely sit
  alongside/inside these same three places). Needs: a `Notification` model
  (userId, ticketId?, type, message, readAt?), a bell/inbox UI component,
  and a decision on delivery — polling (matching the existing 20s
  `AutoRefresh` pattern on `app/tickets/[id]/auto-refresh.tsx`) vs. a
  websocket/SSE push (bigger infra lift, probably not worth it for v1).

## Batch 5 — Billing

- **Invoice model.** `TimeLog`/`Expense` (`prisma/schema.prisma`) already
  have `isApproved`/`isLocked` and `app/billing/page.tsx` +
  `app/billing/export/route.ts` already do the approve/lock/CSV-export
  flow — this item is "what happens after the CSV export" that doesn't
  exist yet: an `Invoice` model (clientId, period, status, totalAmount) +
  `InvoiceLineItem` (linking back to the specific `TimeLog`/`Expense` rows
  it was generated from, so a locked entry can trace to the invoice it
  ended up on) + a page to list/generate/mark-paid invoices. No payment
  processing/integration in scope — just the record-keeping. This is the
  largest single new subsystem in the backlog; give it its own dedicated
  pass, don't bundle it with anything else.

## 🟢 Minor / polish tier

- **Attachment delete/versioning.** `Attachment` model has no delete path
  today — `app/tickets/actions.ts`'s `uploadAttachment` only adds. Simplest
  fix: a `deleteAttachment` action (staff-only, maybe uploader-or-admin-only)
  plus removing the file via `lib/storage.ts`. Versioning (keep old copies)
  is a bigger ask — probably not worth it unless requested.
- **Inline images in comments/descriptions.** Currently attachments are
  link-only, not embeddable in `MarkdownContent`/`MarkdownEditor`. Would
  need image attachments to expose a stable URL
  (`/api/attachments/[id]`already does this) and the markdown editor's
  toolbar to have an "insert image" button that inserts
  `![](/api/attachments/{id})` — doable, but check `rehype-sanitize`'s
  config first since it may currently strip `<img>`/relative URLs.
- **Client resolution-confirm / reopen window.** No concept today of the
  client confirming a `RESOLVED` ticket, or an auto-reopen if they reply
  within N days. Could piggyback on the existing CSAT survey send
  (`lib/csat.ts` already emails on close) — e.g. a "Still having this
  issue?" link in that same email that reopens the ticket — rather than
  building a whole separate mechanism.
- **Data retention/archival policy.** No cron/job trims old CLOSED tickets
  or their attachments. Probably lowest priority in this whole document —
  only worth it once real data volume is a problem.
- **Report breakdowns/export.** `app/reports/page.tsx` has no
  per-agent leaderboard, no ticket-volume-by-category breakdown, and no
  export (contrast `app/billing/export/route.ts`, which already does CSV
  export for billing — same pattern would extend to reports).
- **Bidirectional asset↔ticket view.** `TicketAsset` already links tickets
  to assets from the ticket side (`app/tickets/[id]/page.tsx`'s Assets
  card); there's no reverse "tickets for this asset" list on
  `app/assets/[id]/page.tsx`. Small, additive — just a
  `prisma.ticketAsset.findMany({ where: { assetId } })` query and a list on
  the asset detail page.
