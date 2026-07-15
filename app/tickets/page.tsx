import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import type { Prisma, SlaPolicy, TicketPriority, TicketStatus } from "@prisma/client";
import { getSlaStatus } from "@/lib/sla";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

  function slaCell(ticket: (typeof tickets)[number]) {
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      return <span className="text-xs text-fg-subtle">—</span>;
    }
    const policy = policyByPriority.get(ticket.priority);
    if (!policy || !policy.isActive) {
      return <span className="text-xs text-fg-subtle">No policy</span>;
    }
    const sla = getSlaStatus(ticket, policy);
    if (sla.resolutionBreached) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red">
          <span className="h-[6px] w-[6px] rounded-[2px] bg-red" />
          Resolution overdue
        </span>
      );
    }
    if (sla.responseBreached) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red">
          <span className="h-[6px] w-[6px] rounded-[2px] bg-red" />
          Response overdue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-green">
        <span className="h-[6px] w-[6px] rounded-[2px] bg-green" />
        On track
      </span>
    );
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

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-2.5">Ticket</th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Board</th>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Priority</th>
              <th className="px-4 py-2.5">SLA</th>
              <th className="px-4 py-2.5">Assignee</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-grid hover:bg-surface-2">
                <td className="px-4 py-row-py font-mono font-medium text-fg-muted">
                  <Link href={`/tickets/${ticket.id}`} className="hover:text-accent">
                    #{ticket.id}
                  </Link>
                </td>
                <td className="max-w-[280px] truncate px-4 py-row-py text-fg">
                  <Link href={`/tickets/${ticket.id}`} className="hover:text-accent">
                    {ticket.title}
                  </Link>
                </td>
                <td className="px-4 py-row-py text-fg-muted">{ticket.board.name}</td>
                <td className="px-4 py-row-py text-fg-muted">{ticket.client.name}</td>
                <td className="px-4 py-row-py">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-row-py">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="px-4 py-row-py">{slaCell(ticket)}</td>
                <td className="px-4 py-row-py text-fg-muted">{ticket.assignee?.name ?? "Unassigned"}</td>
                <td className="px-4 py-row-py text-fg-subtle">{ticket.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-fg-subtle">
                  No tickets match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
