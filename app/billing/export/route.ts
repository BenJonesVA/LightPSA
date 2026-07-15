import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

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
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const [timeLogs, expenses] = await Promise.all([
    prisma.timeLog.findMany({
      where: { isLocked: true },
      include: { ticket: { include: { client: true } }, user: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.expense.findMany({
      where: { isLocked: true },
      include: { ticket: { include: { client: true } }, user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  let csv = csvRow(["type", "client", "ticketId", "technician", "description", "hours", "amount", "billable", "date"]);

  for (const log of timeLogs) {
    const description = `${log.workType}${log.notesInternal ? ` — ${log.notesInternal}` : ""}`;
    csv += csvRow([
      "TimeLog",
      log.ticket.client.name,
      `TKT-${log.ticketId}`,
      log.user.name,
      description,
      (log.durationMinutes / 60).toFixed(2),
      "",
      log.billable ? "Yes" : "No",
      log.startTime.toISOString().slice(0, 10),
    ]);
  }

  for (const expense of expenses) {
    csv += csvRow([
      "Expense",
      expense.ticket.client.name,
      `TKT-${expense.ticketId}`,
      expense.user.name,
      expense.description,
      "",
      Number(expense.amount).toFixed(2),
      expense.billable ? "Yes" : "No",
      expense.createdAt.toISOString().slice(0, 10),
    ]);
  }

  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="invoice-export-${today}.csv"`,
    },
  });
}
