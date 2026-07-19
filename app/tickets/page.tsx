import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import type { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { getSlaStatus, loadSlaPolicyResolver } from "@/lib/sla";
import { getOrgLabels } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { bulkUpdateTickets, bulkAssignTickets } from "./actions";
import { saveTicketFilter, deleteTicketFilter } from "./saved-views-actions";
import { TicketsTable, type TicketRow } from "./tickets-table";

const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireStaff();

  const labels = await getOrgLabels();

  const params = await searchParams;
  const boardId = typeof params.boardId === "string" ? params.boardId : undefined;
  const status = typeof params.status === "string" ? (params.status as TicketStatus) : undefined;
  const priority =
    typeof params.priority === "string" ? (params.priority as TicketPriority) : undefined;
  const clientId = typeof params.clientId === "string" ? params.clientId : undefined;
  const q = typeof params.q === "string" ? params.q.trim() : undefined;

  // Kept as a plain string map (rather than reusing `where`) so it can be
  // serialized straight into SavedTicketFilter.query and back into a
  // /tickets?... querystring without carrying any Prisma-specific shape.
  const currentQuery: Record<string, string> = {
    ...(boardId ? { boardId } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q ? { q } : {}),
  };

  const where: Prisma.TicketWhereInput = {
    ...(boardId ? { boardId } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Board-scoped and client/department-scoped RBAC: ADMIN/MANAGER see
  // everything. Other roles are restricted to boards and clients they're a
  // member of — unless they have zero memberships configured for a given
  // dimension, in which case restricting on it would silently show an empty
  // list, so that dimension falls back to unrestricted instead. The two
  // dimensions AND together: a tech with both board and client memberships
  // configured only sees tickets matching both.
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    const [boardMemberships, clientMemberships] = await Promise.all([
      prisma.boardMember.findMany({ where: { userId: user.id }, select: { boardId: true } }),
      prisma.clientMember.findMany({ where: { userId: user.id }, select: { clientId: true } }),
    ]);
    const andClauses: Prisma.TicketWhereInput[] = [];
    if (boardMemberships.length > 0) {
      andClauses.push({ boardId: { in: boardMemberships.map((m) => m.boardId) } });
    }
    if (clientMemberships.length > 0) {
      andClauses.push({ clientId: { in: clientMemberships.map((m) => m.clientId) } });
    }
    if (andClauses.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        ...andClauses,
      ];
    }
  }

  const [tickets, assignableUsers, savedFilters] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        board: { select: { name: true } },
        client: { select: { name: true } },
        assignee: { select: { name: true } },
        comments: { select: { createdAt: true, authorUserId: true, isInternal: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.savedTicketFilter.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const resolveSla = await loadSlaPolicyResolver(tickets.map((t) => t.clientId));

  function slaInfo(ticket: (typeof tickets)[number]): TicketRow["sla"] {
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      return { text: "—", tone: "subtle" };
    }
    const policy = resolveSla(ticket.clientId, ticket.priority);
    if (!policy) {
      return { text: "No policy", tone: "subtle" };
    }
    const sla = getSlaStatus(ticket, policy);
    if (sla.resolutionBreached) return { text: "Resolution overdue", tone: "red" };
    if (sla.responseBreached) return { text: "Response overdue", tone: "red" };
    return { text: "On track", tone: "green" };
  }

  const rows: TicketRow[] = tickets.map((ticket) => ({
    id: ticket.id,
    title: ticket.title,
    boardName: ticket.board.name,
    clientName: ticket.client.name,
    status: ticket.status,
    priority: ticket.priority,
    assigneeName: ticket.assignee?.name ?? null,
    createdAt: ticket.createdAt.toISOString(),
    dueAt: ticket.dueAt ? ticket.dueAt.toISOString() : null,
    sla: slaInfo(ticket),
  }));

  function savedFilterHref(query: Prisma.JsonValue): string {
    const entries = query && typeof query === "object" && !Array.isArray(query) ? query : {};
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
      if (typeof value === "string" && value) sp.set(key, value);
    }
    const qs = sp.toString();
    return qs ? `/tickets?${qs}` : "/tickets";
  }

  async function saveCurrentFilter(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await saveTicketFilter(name, currentQuery);
  }

  async function deleteSavedFilter(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await deleteTicketFilter(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Tickets</h1>
        <Link href="/tickets/new">
          <Button variant="primary">
            <span className="text-[15px] leading-none">+</span>New ticket
          </Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-[6px] block text-xs font-medium text-fg-muted">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Title or description…"
            className="w-56 rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
          />
        </div>
        <div>
          <label className="mb-[6px] block text-xs font-medium text-fg-muted">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-[6px] block text-xs font-medium text-fg-muted">Priority</label>
          <select
            name="priority"
            defaultValue={priority ?? ""}
            className="rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
          >
            <option value="">All</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        {boardId ? <input type="hidden" name="boardId" value={boardId} /> : null}
        {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
        <Link href="/tickets" className="text-sm text-fg-subtle underline">
          Clear
        </Link>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-medium text-fg-muted">Saved views:</span>
        {savedFilters.length === 0 ? (
          <span className="text-fg-subtle">None yet</span>
        ) : (
          savedFilters.map((filter) => (
            <div
              key={filter.id}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 py-1"
            >
              <Link href={savedFilterHref(filter.query)} className="text-fg hover:text-accent">
                {filter.name}
              </Link>
              <form action={deleteSavedFilter}>
                <input type="hidden" name="id" value={filter.id} />
                <button
                  type="submit"
                  aria-label={`Delete saved view ${filter.name}`}
                  className="text-fg-subtle hover:text-red"
                >
                  ×
                </button>
              </form>
            </div>
          ))
        )}
        <form action={saveCurrentFilter} className="flex items-center gap-1.5">
          <input
            type="text"
            name="name"
            placeholder="Save current filter as…"
            required
            className="rounded-lg border border-border-strong bg-surface px-2.5 py-1 text-[13px] text-fg"
          />
          <Button type="submit" variant="secondary" size="sm">
            Save
          </Button>
        </form>
      </div>

      <TicketsTable
        rows={rows}
        bulkUpdate={bulkUpdateTickets}
        bulkAssign={bulkAssignTickets}
        assignableUsers={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
        clientLabel={labels.client}
      />
    </div>
  );
}
