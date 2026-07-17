import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getOrgLabels } from "@/lib/settings";
import { createClient } from "../actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function NewClientPage() {
  await requirePermission(Permission.MANAGE_CLIENTS, UserRole.ADMIN, UserRole.MANAGER);

  const labels = await getOrgLabels();

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">New {labels.client.toLowerCase()}</h1>

      <Card className="mt-6 p-6">
        <ActionForm action={createClient} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">Name</label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Billing address</label>
            <textarea
              name="billingAddress"
              rows={3}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">
              Parent {labels.client === "Department" ? "department" : "company"} (optional)
            </label>
            <select
              name="parentId"
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            >
              <option value="">— None —</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="primary">
            Create {labels.client.toLowerCase()}
          </Button>
        </ActionForm>
      </Card>
    </div>
  );
}
