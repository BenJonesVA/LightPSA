import Link from "next/link";
import { notFound } from "next/navigation";
import { Permission, UserRole, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { isEnterpriseMode } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markInvoiceStatus } from "../actions";

const STATUS_OPTIONS: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PAID,
  InvoiceStatus.VOID,
];

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    DRAFT: "bg-slate-bg text-slate",
    SENT: "bg-amber-bg text-amber",
    PAID: "bg-green-bg text-green",
    VOID: "bg-red-bg text-red",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[status] ?? "bg-slate-bg text-slate"}`}
    >
      {status}
    </span>
  );
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);

  if (await isEnterpriseMode()) {
    notFound();
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lineItems: {
        include: {
          timeLog: { select: { ticketId: true } },
          expense: { select: { ticketId: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  async function updateStatus(formData: FormData) {
    "use server";
    const status = formData.get("status") as InvoiceStatus;
    await markInvoiceStatus(invoice!.id, status);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/invoices" className="text-[13px] text-fg-subtle hover:text-accent">
          &larr; Back to invoices
        </Link>
        <div className="mt-1 flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-fg">
              Invoice — {invoice.client.name}
            </h1>
            <p className="mt-[3px] text-[13.5px] text-fg-muted">
              {invoice.periodStart.toISOString().slice(0, 10)} —{" "}
              {invoice.periodEnd.toISOString().slice(0, 10)}
            </p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-[11.5px] font-medium text-fg-muted">Total Amount</div>
          <div className="mt-[10px] text-[28px] font-bold leading-none tracking-tight text-fg">
            ${Number(invoice.totalAmount).toFixed(2)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11.5px] font-medium text-fg-muted">Update status</div>
          <form action={updateStatus} className="mt-[10px] flex items-center gap-2">
            <select
              name="status"
              defaultValue={invoice.status}
              className="rounded-md border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" size="sm">
              Save
            </Button>
          </form>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-[15px] font-semibold text-fg">Line Items</h2>
        {invoice.lineItems.length === 0 ? (
          <Card className="px-5 py-6">
            <p className="text-sm text-fg-muted">No line items on this invoice.</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Ticket</th>
                  <th className="px-4 py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((li) => {
                  const ticketId = li.timeLog?.ticketId ?? li.expense?.ticketId ?? null;
                  return (
                    <tr key={li.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                      <td className="px-4 py-row-py text-fg">{li.description}</td>
                      <td className="px-4 py-row-py">
                        {ticketId ? (
                          <Link href={`/tickets/${ticketId}`} className="text-fg-muted hover:text-accent">
                            TKT-{ticketId}
                          </Link>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-row-py font-mono text-fg">
                        ${Number(li.amount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
