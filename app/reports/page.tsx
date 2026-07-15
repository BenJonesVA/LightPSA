import { UserRole, ContractType, type TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getSlaStatus } from "@/lib/sla";
import { getCurrentBillingPeriod } from "@/lib/billing-period";
import { formatDuration } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { Bar } from "@/components/ui/bar-chart";
import { ColumnChart } from "@/components/ui/column-chart";

const DAY_MS = 86_400_000;
const PERIOD_DAYS = 30;
const TREND_WEEKS = 8;

// Most-severe-first — the order a manager scanning for problems cares about.
const PRIORITY_ORDER: TicketPriority[] = ["EMERGENCY", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  EMERGENCY: "Emergency",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export default async function ReportsPage() {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
  const trendStart = new Date(now.getTime() - TREND_WEEKS * 7 * DAY_MS);

  const [
    createdInPeriod,
    resolvedInPeriodForAvg,
    slaPolicies,
    ticketsCreatedInPeriod,
    timeLogsInPeriod,
    retainerContracts,
    createdForTrend,
    resolvedForTrend,
    csatSurveysInPeriod,
  ] = await Promise.all([
    prisma.ticket.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.ticket.findMany({
      where: { resolvedAt: { gte: periodStart } },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.slaPolicy.findMany({ where: { isActive: true } }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        priority: true,
        createdAt: true,
        resolvedAt: true,
        comments: { select: { createdAt: true, authorUserId: true, isInternal: true } },
      },
    }),
    prisma.timeLog.findMany({
      where: { startTime: { gte: periodStart } },
      select: { userId: true, durationMinutes: true, billable: true, user: { select: { name: true } } },
    }),
    prisma.contract.findMany({
      where: { type: ContractType.RETAINER, isActive: true },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { client: { name: "asc" } },
    }),
    prisma.ticket.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
    prisma.ticket.findMany({ where: { resolvedAt: { gte: trendStart } }, select: { resolvedAt: true } }),
    prisma.csatResponse.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { rating: true, respondedAt: true },
    }),
  ]);

  // ── Customer satisfaction (surveys sent in the window) ──
  const csatResponded = csatSurveysInPeriod.filter((c) => c.respondedAt !== null);
  const avgCsatRating =
    csatResponded.length > 0
      ? csatResponded.reduce((sum, c) => sum + (c.rating ?? 0), 0) / csatResponded.length
      : null;
  const csatResponseRate =
    csatSurveysInPeriod.length > 0 ? (csatResponded.length / csatSurveysInPeriod.length) * 100 : null;

  // ── Avg resolution time (tickets resolved in the window, regardless of when created) ──
  // Clamped per-ticket at 0: a ticket can't take negative time to resolve, but
  // seed/clock artifacts (resolvedAt a beat before createdAt) can produce one.
  const avgResolutionMs =
    resolvedInPeriodForAvg.length > 0
      ? resolvedInPeriodForAvg.reduce(
          (sum, t) => sum + Math.max(0, t.resolvedAt!.getTime() - t.createdAt.getTime()),
          0
        ) / resolvedInPeriodForAvg.length
      : null;

  // ── SLA compliance (tickets created in the window) ──
  const policyByPriority = new Map(slaPolicies.map((p) => [p.priority, p]));
  const priorityStats = PRIORITY_ORDER.map((priority) => {
    const tickets = ticketsCreatedInPeriod.filter((t) => t.priority === priority);
    const policy = policyByPriority.get(priority);
    const onTime = policy
      ? tickets.filter((t) => {
          const status = getSlaStatus(t, policy, now);
          return !status.responseBreached && !status.resolutionBreached;
        }).length
      : 0;
    return {
      priority,
      total: tickets.length,
      onTime,
      rate: tickets.length > 0 ? (onTime / tickets.length) * 100 : null,
    };
  });
  const overallCompliant = priorityStats.reduce((sum, p) => sum + p.onTime, 0);
  const overallRate =
    ticketsCreatedInPeriod.length > 0 ? (overallCompliant / ticketsCreatedInPeriod.length) * 100 : null;

  // ── Technician utilization ──
  const utilByUser = new Map<string, { name: string; billableMinutes: number; nonBillableMinutes: number }>();
  for (const log of timeLogsInPeriod) {
    const entry =
      utilByUser.get(log.userId) ?? { name: log.user.name, billableMinutes: 0, nonBillableMinutes: 0 };
    if (log.billable) entry.billableMinutes += log.durationMinutes;
    else entry.nonBillableMinutes += log.durationMinutes;
    utilByUser.set(log.userId, entry);
  }
  const utilization = Array.from(utilByUser.values())
    .map((u) => ({ ...u, totalMinutes: u.billableMinutes + u.nonBillableMinutes }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
  const maxUtilMinutes = Math.max(1, ...utilization.map((u) => u.totalMinutes));

  // ── Retainer contract consumption, current period, across all clients ──
  const contractUsage = await Promise.all(
    retainerContracts.map(async (contract) => {
      const { periodStart: pStart, periodEnd: pEnd } = getCurrentBillingPeriod(contract.startDate, now);
      const result = await prisma.timeLog.aggregate({
        where: { contractId: contract.id, billable: true, startTime: { gte: pStart, lt: pEnd } },
        _sum: { durationMinutes: true },
      });
      const usedHours = (result._sum.durationMinutes ?? 0) / 60;
      const blockHours = contract.blockHoursPerPeriod ? Number(contract.blockHoursPerPeriod) : 0;
      return { contract, usedHours, blockHours };
    })
  );

  // ── Weekly created-vs-resolved trend ──
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
    { label: "Tickets created", value: String(createdInPeriod) },
    { label: "Tickets resolved", value: String(resolvedInPeriodForAvg.length) },
    { label: "Avg. resolution time", value: avgResolutionMs !== null ? formatDuration(avgResolutionMs) : "—" },
    { label: "SLA compliance", value: overallRate !== null ? `${overallRate.toFixed(0)}%` : "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Reports</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">Last {PERIOD_DAYS} days, unless noted.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="text-[11.5px] font-medium text-fg-muted">{stat.label}</div>
            <div className="mt-[10px] text-[28px] font-bold leading-none tracking-tight text-fg">
              {stat.value}
            </div>
          </Card>
        ))}
      </div>

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
          <h2 className="text-[13.5px] font-semibold text-fg">SLA compliance by priority</h2>
        </CardHeader>
        <div className="flex flex-col gap-4 p-5">
          {priorityStats.map((p) => (
            <Bar
              key={p.priority}
              label={PRIORITY_LABELS[p.priority]}
              max={100}
              segments={[
                {
                  value: p.rate ?? 0,
                  color: p.rate === null ? "bg-surface-3" : p.rate >= 90 ? "bg-green" : p.rate >= 75 ? "bg-amber" : "bg-red",
                },
              ]}
              displayValue={p.total > 0 ? `${p.onTime}/${p.total} on time (${p.rate!.toFixed(0)}%)` : "No tickets"}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Technician utilization</h2>
        </CardHeader>
        {utilization.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No time logged in this window.</p>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            {utilization.map((u) => (
              <Bar
                key={u.name}
                label={u.name}
                max={maxUtilMinutes}
                segments={[
                  { value: u.billableMinutes, color: "bg-accent" },
                  { value: u.nonBillableMinutes, color: "bg-slate" },
                ]}
                displayValue={`${(u.totalMinutes / 60).toFixed(1)}h (${(u.billableMinutes / 60).toFixed(1)}h billable)`}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Retainer consumption — current period</h2>
        </CardHeader>
        {contractUsage.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No active retainer contracts.</p>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            {contractUsage.map(({ contract, usedHours, blockHours }) => (
              <Bar
                key={contract.id}
                label={contract.client.name}
                sublabel={contract.name}
                max={blockHours}
                segments={[
                  { value: usedHours, color: blockHours > 0 && usedHours > blockHours ? "bg-red" : "bg-accent" },
                ]}
                displayValue={blockHours > 0 ? `${usedHours.toFixed(1)} / ${blockHours} hrs` : `${usedHours.toFixed(1)} hrs`}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Customer satisfaction</h2>
        </CardHeader>
        {csatSurveysInPeriod.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No CSAT surveys sent in this window.</p>
        ) : (
          <div className="grid grid-cols-3 gap-4 p-5">
            <div>
              <div className="text-[11.5px] font-medium text-fg-muted">Avg. rating</div>
              <div className="mt-1 text-[22px] font-bold text-fg">
                {avgCsatRating !== null ? `${avgCsatRating.toFixed(1)}/5` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] font-medium text-fg-muted">Response rate</div>
              <div className="mt-1 text-[22px] font-bold text-fg">
                {csatResponseRate !== null ? `${csatResponseRate.toFixed(0)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] font-medium text-fg-muted">Surveys sent</div>
              <div className="mt-1 text-[22px] font-bold text-fg">{csatSurveysInPeriod.length}</div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
