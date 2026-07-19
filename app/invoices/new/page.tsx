import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { isEnterpriseMode, getOrgLabels } from "@/lib/settings";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateInvoiceAction } from "../actions";

export default async function NewInvoicePage() {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);

  if (await isEnterpriseMode()) {
    notFound();
  }

  const labels = await getOrgLabels();

  const clients = await prisma.client.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">Generate invoice</h1>
      <p className="mt-[3px] text-[13.5px] text-fg-muted">
        Pulls approved and locked time logs and expenses for the selected {labels.client.toLowerCase()}{" "}
        and period that haven&apos;t already been billed onto another invoice.
      </p>

      <Card className="mt-6 p-6">
        <ActionForm action={generateInvoiceAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">{labels.client}</label>
            <select
              name="clientId"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            >
              <option value="">Select a {labels.client.toLowerCase()}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted">Period start</label>
              <input
                type="date"
                name="periodStart"
                required
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted">Period end</label>
              <input
                type="date"
                name="periodEnd"
                required
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              />
            </div>
          </div>

          <Button type="submit" variant="primary">
            Generate invoice
          </Button>
        </ActionForm>
      </Card>
    </div>
  );
}
