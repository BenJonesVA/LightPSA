import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { createTicket } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function NewTicketPage() {
  await requireStaff();

  const [boards, clients, categories] = await Promise.all([
    prisma.board.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">New ticket</h1>

      <Card className="mt-6 p-6">
        <form action={createTicket} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">Title</label>
            <input
              type="text"
              name="title"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Description</label>
            <textarea
              name="description"
              rows={4}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

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
              <label className="block text-sm font-medium text-fg-muted">Client</label>
              <select
                name="clientId"
                required
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-muted">Priority</label>
              <select
                name="priority"
                defaultValue="MEDIUM"
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-muted">Category</label>
              <select
                name="categoryId"
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" variant="primary">
            Create ticket
          </Button>
        </form>
      </Card>
    </div>
  );
}
