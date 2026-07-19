import Link from "next/link";
import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { isEnterpriseMode } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

export default async function InvoicesPage() {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);

  if (await isEnterpriseMode()) {
    notFound();
  }

  const invoices = await prisma.invoice.findMany({
    include: { client: true, lineItems: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-fg">Invoices</h1>
          <p className="mt-[3px] text-[13.5px] text-fg-muted">
            Draft, sent, paid, and voided invoices generated from locked billing entries.
          </p>
        </div>
        <Link href="/invoices/new">
          <Button variant="primary">
            <span className="text-[15px] leading-none">+</span>Generate invoice
          </Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <Card className="px-5 py-6">
          <p className="text-sm text-fg-muted">No invoices yet.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Line items</th>
                <th className="px-4 py-2.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-row-py font-medium">
                    <Link href={`/invoices/${invoice.id}`} className="text-fg hover:text-accent">
                      {invoice.client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">
                    {invoice.periodStart.toISOString().slice(0, 10)} —{" "}
                    {invoice.periodEnd.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-row-py">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">{invoice.lineItems.length}</td>
                  <td className="px-4 py-row-py font-mono text-fg">
                    ${Number(invoice.totalAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
