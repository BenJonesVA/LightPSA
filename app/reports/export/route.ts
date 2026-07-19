import { UserRole, ContractType, Permission, type TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getSlaStatus } from "@/lib/sla";

const DAY_MS = 86_400_000;
const PERIOD_DAYS = 30;

// Most-severe-first — matches app/reports/page.tsx.
const PRIORITY_ORDER: TicketPriority[] = ["EMERGENCY", "HIGH", "MEDIUM", "LOW"];
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  EMERGENCY: "Emergency",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map((f) => csvEscape(String(f))).join(",") + "\n";
}

export async function GET() {
  await requirePermission(Permission.VIEW_REPORTS, UserRole.ADMIN, UserRole.MANAGER);

  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);

  const [createdInPeriod, resolvedInPeriod, slaPolicies, ticketsCreatedInPeriod, timeLogsInPeriod] =
    await Promise.all([
      prisma.ticket.count({ where: { createdAt: { gte: periodStart } } }),
      prisma.ticket.findMany({
        where: { resolvedAt: { gte: periodStart } },
        select: {
          resolvedAt: true,
          assigneeId: true,
          assignee: { select: { name: true } },
        },
      }),
      prisma.slaPolicy.findMany({ where: { isActive: true } }),
      prisma.ticket.findMany({
        where: { createdAt: { gte: periodStart } },
        select: {
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
          waitingSince: true,
          totalWaitMinutes: true,
          categoryId: true,
          category: { select: { name: true } },
          comments: { select: { createdAt: true, authorUserId: true, isInternal: true } },
        },
      }),
      prisma.timeLog.findMany({
        where: { startTime: { gte: periodStart } },
        select: { userId: true, durationMinutes: true, billable: true, user: { select: { name: true } } },
      }),
    ]);

  // ── SLA compliance by priority (tickets created in the window) ──
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

  // ── Per-agent leaderboard (tickets resolved/closed + billable hours in the window) ──
  const utilByUser = new Map<string, { name: string; billableMinutes: number }>();
  for (const log of timeLogsInPeriod) {
    if (!log.billable) continue;
    const entry = utilByUser.get(log.userId) ?? { name: log.user.name, billableMinutes: 0 };
    entry.billableMinutes += log.durationMinutes;
    utilByUser.set(log.userId, entry);
  }
  const resolvedCountByUser = new Map<string, { name: string; count: number }>();
  for (const t of resolvedInPeriod) {
    if (!t.assigneeId) continue;
    const entry = resolvedCountByUser.get(t.assigneeId) ?? { name: t.assignee?.name ?? "Unknown", count: 0 };
    entry.count += 1;
    resolvedCountByUser.set(t.assigneeId, entry);
  }
  const leaderboardUserIds = new Set([...resolvedCountByUser.keys(), ...utilByUser.keys()]);
  const leaderboard = Array.from(leaderboardUserIds)
    .map((userId) => {
      const resolved = resolvedCountByUser.get(userId);
      const util = utilByUser.get(userId);
      return {
        name: resolved?.name ?? util?.name ?? "Unknown",
        resolvedCount: resolved?.count ?? 0,
        billableMinutes: util?.billableMinutes ?? 0,
      };
    })
    .sort((a, b) => b.resolvedCount - a.resolvedCount || b.billableMinutes - a.billableMinutes);

  // ── Ticket volume by category (tickets created in the window) ──
  const categoryCounts = new Map<string, { name: string; count: number }>();
  for (const t of ticketsCreatedInPeriod) {
    const key = t.categoryId ?? "uncategorized";
    const name = t.category?.name ?? "Uncategorized";
    const entry = categoryCounts.get(key) ?? { name, count: 0 };
    entry.count += 1;
    categoryCounts.set(key, entry);
  }
  const categoryBreakdown = Array.from(categoryCounts.values()).sort((a, b) => b.count - a.count);

  const today = now.toISOString().slice(0, 10);

  let csv = "";

  csv += csvRow(["Report period", `Last ${PERIOD_DAYS} days`]);
  csv += csvRow(["Generated", today]);
  csv += "\n";

  csv += csvRow(["Summary"]);
  csv += csvRow(["metric", "value"]);
  csv += csvRow(["Tickets created", createdInPeriod]);
  csv += csvRow(["Tickets resolved", resolvedInPeriod.length]);
  csv += "\n";

  csv += csvRow(["SLA compliance by priority"]);
  csv += csvRow(["priority", "total", "onTime", "rate"]);
  for (const p of priorityStats) {
    csv += csvRow([
      PRIORITY_LABELS[p.priority],
      p.total,
      p.onTime,
      p.rate !== null ? `${p.rate.toFixed(0)}%` : "",
    ]);
  }
  csv += "\n";

  csv += csvRow(["Agent leaderboard"]);
  csv += csvRow(["agent", "resolvedClosed", "billableHours"]);
  for (const agent of leaderboard) {
    csv += csvRow([agent.name, agent.resolvedCount, (agent.billableMinutes / 60).toFixed(2)]);
  }
  csv += "\n";

  csv += csvRow(["Ticket volume by category"]);
  csv += csvRow(["category", "ticketsCreated"]);
  for (const c of categoryBreakdown) {
    csv += csvRow([c.name, c.count]);
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="reports-export-${today}.csv"`,
    },
  });
}
