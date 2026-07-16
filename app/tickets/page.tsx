import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import type { Prisma, SlaPolicy, TicketPriority, TicketStatus } from "@prisma/client";
import { getSlaStatus } from "@/lib/sla";
import { getOrgLabels } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { bulkUpdateTickets } from "./actions";
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
  await requireStaff();

  const labels = await getOrgLabels();

  const params = await searchParams;
  const boardId = typeof params.boardId === "string" ? params.boardId : undefined;
  const status = typeof params.status === "string" ? (params.status as TicketStatus) : undefined;
  const priority =
    typeof params.priority === "string" ? (params.priority as TicketPriority) : undefined;
  const clientId = typeof params.clientId === "string" ? params.clientId : undefined;

  const where: Prisma.TicketWhereInput = {
    ...(boardId ? { boardId } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(clientId ? { clientId } : {}),
  };

  const [tickets, policies] = await Promise.all([
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
    prisma.slaPolicy.findMany(),
  ]);

  const policyByPriority = new Map<TicketPriority, SlaPolicy>(policies.map((p) => [p.priority, p]));

  function slaInfo(ticket: (typeof tickets)[number]): TicketRow["sla"] {
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      return { text: "—", tone: "subtle" };
    }
    const policy = policyByPriority.get(ticket.priority);
    if (!policy || !policy.isActive) {
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
    sla: slaInfo(ticket),
  }));

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

      <TicketsTable rows={rows} bulkUpdate={bulkUpdateTickets} clientLabel={labels.client} />
    </div>
  );
}
