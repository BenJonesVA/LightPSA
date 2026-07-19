import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { deleteBoard, updateBoard, setBoardMembers } from "../actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(Permission.MANAGE_BOARDS, UserRole.ADMIN, UserRole.MANAGER);

  const { id } = await params;

  const [board, allUsers, boardMembers] = await Promise.all([
    prisma.board.findUnique({
      where: { id },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.boardMember.findMany({ where: { boardId: id }, select: { userId: true } }),
  ]);

  if (!board) {
    notFound();
  }

  const memberUserIds = new Set(boardMembers.map((m) => m.userId));
  const updateBoardForBoard = updateBoard.bind(null, board.id);
  const deleteBoardForBoard = deleteBoard.bind(null, board.id);
  const setMembersForBoard = setBoardMembers.bind(null, board.id);

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

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Members</h2>
        </CardHeader>
        <p className="border-b border-border px-5 py-3 text-xs text-fg-subtle">
          Restricts which users can see and be assigned tickets on this board — leave unchecked
          entirely to leave a user unrestricted on this board.
        </p>
        {allUsers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No active users exist yet.</p>
        ) : (
          <ActionForm action={setMembersForBoard} className="flex flex-col gap-3 p-5">
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {allUsers.map((user) => (
                <label key={user.id} className="flex items-center gap-2.5 text-sm text-fg-muted">
                  <input
                    type="checkbox"
                    name="userIds"
                    value={user.id}
                    defaultChecked={memberUserIds.has(user.id)}
                    className="rounded border-border-strong accent-accent"
                  />
                  {user.name}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm">
                Save members
              </Button>
            </div>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
