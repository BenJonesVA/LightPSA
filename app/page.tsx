import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSlaStatus } from "@/lib/sla";
import { requireStaff } from "@/lib/rbac";
import { getOrgLabels } from "@/lib/settings";
import { Card, CardHeader } from "@/components/ui/card";
import { Bar } from "@/components/ui/bar-chart";
import { ColumnChart } from "@/components/ui/column-chart";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import type { TicketPriority } from "@prisma/client";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] as const;
const DAY_MS = 86_400_000;
const TREND_WEEKS = 4;
const UPCOMING_VISITS = 5;
const RECENT_TICKETS = 6;

// Most-severe-first — the order a manager scanning for problems cares about.
const PRIORITY_ORDER: TicketPriority[] = ["EMERGENCY", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  EMERGENCY: "Emergency",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};
const PRIORITY_COLORS: Record<TicketPriority, string> = {
  EMERGENCY: "bg-red",
  HIGH: "bg-orange",
  MEDIUM: "bg-amber",
  LOW: "bg-slate",
};

export default async function DashboardPage() {
  // Every other staff page calls this; the dashboard didn't, which meant it
  // was relying solely on middleware's coarse check — no isActive
  // re-validation, so a deactivated staff account's still-valid-signature
  // session could keep viewing this page indefinitely.
  await requireStaff();

  const labels = await getOrgLabels();

  const now = new Date();
  const trendStart = new Date(now.getTime() - TREND_WEEKS * 7 * DAY_MS);

  const [
    activeClientCount,
    boards,
    policies,
    openTickets,
    unassignedCount,
    createdForTrend,
    resolvedForTrend,
    upcomingVisits,
    recentTickets,
  ] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.board.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.slaPolicy.findMany({ where: { isActive: true } }),
    prisma.ticket.findMany({
      where: { status: { in: [...OPEN_STATUSES] } },
      select: {
        priority: true,
        createdAt: true,
        resolvedAt: true,
        comments: { select: { createdAt: true, authorUserId: true, isInternal: true } },
      },
    }),
    prisma.ticket.count({ where: { status: { in: [...OPEN_STATUSES] }, assigneeId: null } }),
    prisma.ticket.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
    prisma.ticket.findMany({ where: { resolvedAt: { gte: trendStart } }, select: { resolvedAt: true } }),
    prisma.scheduledVisit.findMany({
      where: { startTime: { gte: now } },
      orderBy: { startTime: "asc" },
      take: UPCOMING_VISITS,
      include: {
        ticket: { select: { id: true, title: true, client: { select: { name: true } } } },
        technician: { select: { name: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { status: { in: [...OPEN_STATUSES] } },
      orderBy: { updatedAt: "desc" },
      take: RECENT_TICKETS,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        client: { select: { name: true } },
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

  const priorityCounts = PRIORITY_ORDER.map((priority) => ({
    priority,
    count: openTickets.filter((t) => t.priority === priority).length,
  }));
  const maxPriorityCount = Math.max(1, ...priorityCounts.map((p) => p.count));

  // Weekly created-vs-resolved trend, same bucketing approach as Reports —
  // a shorter window here (4 weeks vs. Reports' 8) since this is meant as an
  // at-a-glance pulse, not the historical deep-dive Reports already covers.
  const weekBuckets = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const end = new Date(now.getTime() - i * 7 * DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    return { start, end };
  }).reverse();
  const bucketCounts = (dates: Date[]) =>
    weekBuckets.map(({ start, end }) => dates.filter((d) => d >= start && d < end).length);
  const createdCounts = bucketCounts(createdForTrend.map((t) => t.createdAt));
  const resolvedCounts = bucketCounts(
    resolvedForTrend.map((t) => t.resolvedAt).filter((d): d is Date => d !== null)
  );
  const trendData = weekBuckets.map(({ start }, i) => ({
    label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    series: [
      { value: createdCounts[i], color: "bg-blue" },
      { value: resolvedCounts[i], color: "bg-green" },
    ],
  }));

  const stats = [
    { label: "Open tickets", value: openTickets.length, accent: null },
    { label: "SLA breached", value: breachedCount, accent: breachedCount > 0 ? "red" : null },
    { label: "Unassigned", value: unassignedCount, accent: unassignedCount > 0 ? "amber" : null },
    { label: `Active ${labels.clients.toLowerCase()}`, value: activeClientCount, accent: null },
    { label: "Boards", value: boards.length, accent: null },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Dashboard</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">Overview of open work across all boards.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden p-4">
            {stat.accent && (
              <span className={`absolute inset-y-0 left-0 w-[3px] ${stat.accent === "red" ? "bg-red" : "bg-amber"}`} />
            )}
            <div className="text-[11.5px] font-medium text-fg-muted">{stat.label}</div>
            <div
              className={`mt-[10px] text-[28px] font-bold leading-none tracking-tight ${
                stat.accent === "red" ? "text-red" : stat.accent === "amber" ? "text-amber" : "text-fg"
              }`}
            >
              {stat.value}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[13.5px] font-semibold text-fg">Ticket volume — last {TREND_WEEKS} weeks</h2>
            <div className="flex items-center gap-3 text-[11.5px] text-fg-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue" /> Created
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green" /> Resolved
              </span>
            </div>
          </div>
          <div className="mt-4">
            <ColumnChart data={trendData} />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-[13.5px] font-semibold text-fg">Open tickets by priority</h2>
          </CardHeader>
          <div className="flex flex-col gap-4 p-5">
            {priorityCounts.map((p) => (
              <Bar
                key={p.priority}
                label={PRIORITY_LABELS[p.priority]}
                max={maxPriorityCount}
                segments={[{ value: p.count, color: PRIORITY_COLORS[p.priority] }]}
                displayValue={String(p.count)}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <h2 className="text-[13.5px] font-semibold text-fg">Upcoming visits</h2>
          </CardHeader>
          {upcomingVisits.length === 0 ? (
            <p className="px-5 py-6 text-sm text-fg-muted">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-grid">
              {upcomingVisits.map((visit) => (
                <li key={visit.id} className="px-5 py-3">
                  <Link href={`/tickets/${visit.ticket.id}`} className="font-medium text-fg hover:text-accent">
                    TKT-{visit.ticket.id} · {visit.ticket.title}
                  </Link>
                  <div className="mt-0.5 text-[12px] text-fg-muted">
                    {visit.startTime.toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {visit.technician.name} · {visit.ticket.client.name}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Recently updated tickets</h2>
        </CardHeader>
        {recentTickets.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No open tickets.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-5 py-2.5">Ticket</th>
                <th className="px-5 py-2.5">{labels.client}</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Priority</th>
                <th className="px-5 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-grid last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/tickets/${ticket.id}`} className="font-medium text-fg hover:text-accent">
                      TKT-{ticket.id} · {ticket.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-fg-muted">{ticket.client.name}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="px-5 py-3">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-5 py-3 text-fg-muted">
                    {ticket.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
