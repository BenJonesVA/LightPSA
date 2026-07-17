import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { deleteBoard, updateBoard } from "../actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(Permission.MANAGE_BOARDS, UserRole.ADMIN, UserRole.MANAGER);

  const { id } = await params;

  const board = await prisma.board.findUnique({
    where: { id },
  });

  if (!board) {
    notFound();
  }

  const updateBoardForBoard = updateBoard.bind(null, board.id);
  const deleteBoardForBoard = deleteBoard.bind(null, board.id);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">{board.name}</h1>

      <Card className="mt-6 p-6">
        <ActionForm action={updateBoardForBoard} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-fg-muted">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={board.name}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-focus"
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
              defaultValue={board.description ?? ""}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-focus"
              placeholder="Optional description"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={board.isActive}
              className="rounded border-border-strong accent-accent"
            />
            Active
          </label>

          <div className="flex justify-end gap-3">
            <a href="/boards">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </ActionForm>

        <div className="mt-6 flex justify-end border-t border-border pt-6">
          <DeleteButton action={deleteBoardForBoard} label="Delete board" />
        </div>
      </Card>
    </div>
  );
}
