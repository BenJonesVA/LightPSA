import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSlaStatus } from "@/lib/sla";
import { requireStaff } from "@/lib/rbac";
import { Card, CardHeader } from "@/components/ui/card";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] as const;

export default async function DashboardPage() {
  // Every other staff page calls this; the dashboard didn't, which meant it
  // was relying solely on middleware's coarse check — no isActive
  // re-validation, so a deactivated staff account's still-valid-signature
  // session could keep viewing this page indefinitely.
  await requireStaff();

  const [openTicketCount, activeClientCount, boards, policies, openTickets] = await Promise.all([
    prisma.ticket.count({ where: { status: { in: [...OPEN_STATUSES] } } }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.board.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.slaPolicy.findMany({ where: { isActive: true } }),
    prisma.ticket.findMany({
      where: { status: { in: [...OPEN_STATUSES] } },
      select: {
        createdAt: true,
        resolvedAt: true,
        priority: true,
        comments: { select: { createdAt: true, authorUserId: true, isInternal: true } },
      },
    }),
  ]);

  const boardCounts = await Promise.all(
    boards.map((board) =>
      prisma.ticket.count({
        where: { boardId: board.id, status: { in: [...OPEN_STATUSES] } },
      })
    )
  );

  const policyByPriority = new Map(policies.map((p) => [p.priority, p]));
  const breachedCount = openTickets.filter((t) => {
    const policy = policyByPriority.get(t.priority);
    if (!policy) return false;
    const status = getSlaStatus(t, policy);
    return status.responseBreached || status.resolutionBreached;
  }).length;

  const stats = [
    { label: "Open tickets", value: openTicketCount, accent: null },
    { label: "SLA breached", value: breachedCount, accent: breachedCount > 0 ? "red" : null },
    { label: "Active clients", value: activeClientCount, accent: null },
    { label: "Boards", value: boards.length, accent: null },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Dashboard</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">Overview of open work across all boards.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden p-4">
            {stat.accent && <span className="absolute inset-y-0 left-0 w-[3px] bg-red" />}
            <div className="text-[11.5px] font-medium text-fg-muted">{stat.label}</div>
            <div
              className={`mt-[10px] text-[28px] font-bold leading-none tracking-tight ${
                stat.accent === "red" ? "text-red" : "text-fg"
              }`}
            >
              {stat.value}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Open tickets by board</h2>
        </CardHeader>
        {boards.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No boards yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-5 py-2.5">Board</th>
                <th className="px-5 py-2.5">Open tickets</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board, i) => (
                <tr key={board.id} className="border-b border-grid last:border-0">
                  <td className="px-5 py-3">
                    <Link href="/boards" className="font-medium text-fg hover:text-accent">
                      {board.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-fg-muted">{boardCounts[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
