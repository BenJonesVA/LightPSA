import { Permission, UserRole } from "@prisma/client";
import { createBoard } from "@/app/boards/actions";
import { requirePermission } from "@/lib/rbac";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function NewBoardPage() {
  await requirePermission(Permission.MANAGE_BOARDS, UserRole.ADMIN, UserRole.MANAGER);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">New board</h1>

      <Card className="mt-6 p-6">
        <ActionForm action={createBoard} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-fg-muted">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              placeholder="e.g. Support"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-fg-muted">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-3">
            <a href="/boards">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Create board
            </Button>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
