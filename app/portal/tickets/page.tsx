import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/rbac";
import type { TicketStatus } from "@prisma/client";
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

export default async function PortalTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireClientSession();
  const { status } = await searchParams;

  const statusFilter =
    status && STATUS_OPTIONS.includes(status as TicketStatus) ? (status as TicketStatus) : undefined;

  const tickets = await prisma.ticket.findMany({
    where: {
      clientId: user.clientId!,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { board: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[28px] font-bold tracking-tight text-fg">My Tickets</h1>
        <Link href="/portal/tickets/new" className="sm:w-auto">
          <Button variant="primary" className="w-full justify-center px-6 py-3 text-[15px]">
            New ticket
          </Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-2 block text-[13px] font-medium text-fg-muted">Status</label>
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" className="px-6 py-3 text-[15px]">
          Filter
        </Button>
      </form>

      <Card className="rounded-2xl">
        {tickets.length === 0 ? (
          <p className="px-6 py-10 text-center text-[15px] text-fg-muted">No tickets found.</p>
        ) : (
          <ul className="divide-y divide-grid">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/portal/tickets/${t.id}`}
                  className="flex flex-col gap-3 px-6 py-5 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-fg">
                      TKT-{t.id} — {t.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-fg-subtle">
                      <span>{t.board.name}</span>
                      <span>·</span>
                      <span>{t.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
