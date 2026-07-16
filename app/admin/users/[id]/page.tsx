import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { deleteUser, updateUser } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";

const ROLE_OPTIONS = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] as const;

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(UserRole.ADMIN);

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    notFound();
  }

  const updateUserForId = updateUser.bind(null, user.id);
  const deleteUserForId = deleteUser.bind(null, user.id);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">{user.name}</h1>
      <p className="mt-[3px] text-[13.5px] text-fg-muted">{user.email}</p>

      <Card className="mt-6 p-6">
        <form action={updateUserForId} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">Email</label>
            <p className="mt-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted">
              {user.email}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Name</label>
            <input
              name="name"
              required
              defaultValue={user.name}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Title (optional)</label>
            <input
              name="title"
              defaultValue={user.title ?? ""}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Role</label>
            <select
              name="role"
              defaultValue={user.role}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={user.isActive}
              className="rounded border-border-strong accent-accent"
            />
            Active
          </label>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Reset password (optional)</label>
            <input
              name="password"
              type="password"
              minLength={8}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              placeholder="Leave blank to keep current password"
            />
            <p className="mt-1 text-xs text-fg-subtle">At least 8 characters. Leave blank to leave unchanged.</p>
          </div>

          <div className="flex justify-end gap-3">
            <a href="/admin/users">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 flex justify-end">
        <DeleteButton action={deleteUserForId} label="Delete user" />
      </div>
    </div>
  );
}
