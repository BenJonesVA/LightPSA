import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createTicketTemplate, deleteTicketTemplate, updateTicketTemplate } from "./actions";
import { ActionForm } from "@/components/ui/action-form";

const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"] as const;

function BoardSelect({ boards, defaultValue }: { boards: { id: string; name: string }[]; defaultValue?: string }) {
  return (
    <select name="boardId" defaultValue={defaultValue ?? ""} className={inputClass}>
      <option value="">Any board</option>
      {boards.map((board) => (
        <option key={board.id} value={board.id}>
          {board.name}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({ categories, defaultValue }: { categories: { id: string; name: string }[]; defaultValue?: string }) {
  return (
    <select name="categoryId" defaultValue={defaultValue ?? ""} className={inputClass}>
      <option value="">No default category</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}

function PrioritySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="priority" defaultValue={defaultValue ?? "MEDIUM"} className={inputClass}>
      {PRIORITY_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

export default async function TicketTemplatesAdminPage() {
  await requirePermission(Permission.MANAGE_TICKET_TEMPLATES, UserRole.ADMIN, UserRole.MANAGER);

  const [templates, boards, categories] = await Promise.all([
    prisma.ticketTemplate.findMany({ orderBy: { name: "asc" }, include: { board: true, category: true } }),
    prisma.board.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Ticket Templates</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Prefilled content staff can start a new ticket from.
        </p>
      </div>

      <Card className="p-4">
        <h2 className="text-[15px] font-semibold text-fg">New template</h2>
        <ActionForm action={createTicketTemplate} className="mt-3 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Template name</span>
            <input type="text" name="name" required className={inputClass} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Board scope</span>
              <BoardSelect boards={boards} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Default category</span>
              <CategorySelect categories={categories} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Default priority</span>
              <PrioritySelect />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Title template</span>
            <input type="text" name="titleTemplate" required className={inputClass} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Description template</span>
            <textarea name="descriptionTemplate" rows={4} className={inputClass} />
          </label>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </div>
        </ActionForm>
      </Card>

      <div className="flex flex-col gap-3">
        {templates.map((template) => (
          <Card key={template.id} className="p-4">
            <ActionForm action={updateTicketTemplate.bind(null, template.id)} className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-fg-subtle">
                <span>{template.board ? template.board.name : "Any board"}</span>
                <span>{template.category ? template.category.name : "No default category"}</span>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Template name</span>
                <input type="text" name="name" required defaultValue={template.name} className={inputClass} />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Board scope</span>
                  <BoardSelect boards={boards} defaultValue={template.boardId ?? ""} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Default category</span>
                  <CategorySelect categories={categories} defaultValue={template.categoryId ?? ""} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Default priority</span>
                  <PrioritySelect defaultValue={template.priority} />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Title template</span>
                <input
                  type="text"
                  name="titleTemplate"
                  required
                  defaultValue={template.titleTemplate}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Description template</span>
                <textarea
                  name="descriptionTemplate"
                  rows={4}
                  defaultValue={template.descriptionTemplate}
                  className={inputClass}
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <Button type="submit" variant="primary" size="sm">
                  Save
                </Button>
              </div>
            </ActionForm>
            <form action={deleteTicketTemplate.bind(null, template.id)} className="mt-2 flex justify-end">
              <Button type="submit" variant="danger" size="sm">
                Delete
              </Button>
            </form>
          </Card>
        ))}

        {templates.length === 0 ? (
          <p className="text-[13.5px] text-fg-subtle">No ticket templates yet.</p>
        ) : null}
      </div>
    </div>
  );
}
