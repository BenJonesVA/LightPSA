import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { getOrgLabels } from "@/lib/settings";
import { createTicket } from "../actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseFieldSchema } from "@/lib/asset-fields";
import { TicketCreateFields } from "@/components/ui/ticket-create-fields";

export default async function NewTicketPage() {
  await requireStaff();

  const labels = await getOrgLabels();

  const [boards, clients, categories, templates] = await Promise.all([
    prisma.board.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.ticketTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
    fields: parseFieldSchema(category.fieldSchema),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">New ticket</h1>

      <Card className="mt-6 p-6">
        <ActionForm action={createTicket} className="space-y-4">
          <TicketCreateFields categories={categoryOptions} templates={templates} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted">Board</label>
              <select
                name="boardId"
                required
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="">Select a board</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>

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
          </div>

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="expensesEnabled" className="rounded border-border-strong accent-accent" />
            Track expenses for this ticket
          </label>

          <Button type="submit" variant="primary">
            Create ticket
          </Button>
        </ActionForm>
      </Card>
    </div>
  );
}
