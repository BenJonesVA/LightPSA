import Link from "next/link";
import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { isEnterpriseMode } from "@/lib/settings";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { approveTimeLog, lockTimeLog, approveExpense, lockExpense } from "./actions";

function ApprovalStatusBadge({ isApproved, isLocked }: { isApproved: boolean; isLocked: boolean }) {
  if (isLocked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-bg px-2.5 py-0.5 text-xs font-semibold text-slate">
        <span className="h-[7px] w-[7px] rounded-full bg-slate" />
        Locked
      </span>
    );
  }
  if (isApproved) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-bg px-2.5 py-0.5 text-xs font-semibold text-green">
        <span className="h-[7px] w-[7px] rounded-full bg-green" />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-amber">
      <span className="h-[7px] w-[7px] rounded-full bg-amber" />
      Pending
    </span>
  );
}

function BillableLabel({ billable }: { billable: boolean }) {
  if (billable) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-green">
        <span className="h-2 w-2 rounded-[2px] bg-green" />
        Billable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate">
      <span className="h-2 w-2 rounded-[2px] bg-slate" />
      No-charge
    </span>
  );
}

export default async function BillingPage() {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);

  if (await isEnterpriseMode()) {
    notFound();
  }

  const [timeLogs, expenses] = await Promise.all([
    prisma.timeLog.findMany({
      where: { isLocked: false },
      include: { ticket: { include: { client: true } }, user: true },
      orderBy: { startTime: "desc" },
    }),
    prisma.expense.findMany({
      where: { isLocked: false },
      include: { ticket: { include: { client: true } }, user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const billableHours =
    timeLogs.filter((t) => t.billable).reduce((sum, t) => sum + t.durationMinutes, 0) / 60;
  const billableExpenseTotal = expenses
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-fg">Billing Review Queue</h1>
          <p className="mt-[3px] text-[13.5px] text-fg-muted">
            Unlocked time entries and expenses awaiting approval and invoicing.
          </p>
        </div>
        <a href="/billing/export">
          <Button variant="secondary">Export CSV (locked entries)</Button>
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-[11.5px] font-medium text-fg-muted">Unbilled Billable Hours</div>
          <div className="mt-[10px] text-[28px] font-bold leading-none tracking-tight text-fg">
            {billableHours.toFixed(2)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11.5px] font-medium text-fg-muted">Unbilled Billable Expenses</div>
          <div className="mt-[10px] text-[28px] font-bold leading-none tracking-tight text-fg">
            ${billableExpenseTotal.toFixed(2)}
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-[15px] font-semibold text-fg">Time Logs</h2>
        {timeLogs.length === 0 ? (
          <Card className="px-5 py-6">
            <p className="text-sm text-fg-muted">No unlocked time logs.</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                  <th className="px-4 py-2.5">Ticket</th>
                  <th className="px-4 py-2.5">Client</th>
                  <th className="px-4 py-2.5">Technician</th>
                  <th className="px-4 py-2.5">Hours</th>
                  <th className="px-4 py-2.5">Work Type</th>
                  <th className="px-4 py-2.5">Billable</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((log) => (
                  <tr key={log.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-row-py font-medium">
                      <Link href={`/tickets/${log.ticketId}`} className="text-fg hover:text-accent">
                        TKT-{log.ticketId} — {log.ticket.title}
                      </Link>
                    </td>
                    <td className="px-4 py-row-py text-fg-muted">{log.ticket.client.name}</td>
                    <td className="px-4 py-row-py text-fg-muted">{log.user.name}</td>
                    <td className="px-4 py-row-py font-mono text-fg">
                      {(log.durationMinutes / 60).toFixed(2)}
                    </td>
                    <td className="px-4 py-row-py text-fg-muted">{log.workType}</td>
                    <td className="px-4 py-row-py">
                      <BillableLabel billable={log.billable} />
                    </td>
                    <td className="px-4 py-row-py">
                      <ApprovalStatusBadge isApproved={log.isApproved} isLocked={log.isLocked} />
                    </td>
                    <td className="px-4 py-row-py">
                      <div className="flex gap-2">
                        {!log.isApproved && (
                          <form action={approveTimeLog.bind(null, log.id)}>
                            <Button type="submit" variant="primary" size="sm">
                              Approve
                            </Button>
                          </form>
                        )}
                        <form action={lockTimeLog.bind(null, log.id)}>
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={!log.isApproved}
                            className="disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Lock
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-[15px] font-semibold text-fg">Expenses</h2>
        {expenses.length === 0 ? (
          <Card className="px-5 py-6">
            <p className="text-sm text-fg-muted">No unlocked expenses.</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                  <th className="px-4 py-2.5">Ticket</th>
                  <th className="px-4 py-2.5">Client</th>
                  <th className="px-4 py-2.5">Technician</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Billable</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-row-py font-medium">
                      <Link href={`/tickets/${expense.ticketId}`} className="text-fg hover:text-accent">
                        TKT-{expense.ticketId} — {expense.ticket.title}
                      </Link>
                    </td>
                    <td className="px-4 py-row-py text-fg-muted">{expense.ticket.client.name}</td>
                    <td className="px-4 py-row-py text-fg-muted">{expense.user.name}</td>
                    <td className="px-4 py-row-py text-fg-muted">{expense.type}</td>
                    <td className="px-4 py-row-py text-fg-muted">{expense.description}</td>
                    <td className="px-4 py-row-py font-mono text-fg">
                      ${Number(expense.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-row-py">
                      <BillableLabel billable={expense.billable} />
                    </td>
                    <td className="px-4 py-row-py">
                      <ApprovalStatusBadge isApproved={expense.isApproved} isLocked={expense.isLocked} />
                    </td>
                    <td className="px-4 py-row-py">
                      <div className="flex gap-2">
                        {!expense.isApproved && (
                          <form action={approveExpense.bind(null, expense.id)}>
                            <Button type="submit" variant="primary" size="sm">
                              Approve
                            </Button>
                          </form>
                        )}
                        <form action={lockExpense.bind(null, expense.id)}>
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={!expense.isApproved}
                            className="disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Lock
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
