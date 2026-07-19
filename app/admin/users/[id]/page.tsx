import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getOrgLabels } from "@/lib/settings";
import { deleteUser, updateUser, setUserPermissionGroups, setUserClientMemberships } from "../actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";

const ROLE_OPTIONS = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] as const;

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePermission(Permission.MANAGE_USERS, UserRole.ADMIN);
  // Group *assignment* stays ADMIN-only regardless of a granted MANAGE_USERS
  // permission (setUserPermissionGroups enforces this too) — otherwise a
  // permissioned non-admin could hand themselves or anyone else more access
  // than an ADMIN chose to grant.
  const viewerIsAdmin = viewer.role === UserRole.ADMIN;

  const { id } = await params;
  const labels = await getOrgLabels();

  const [user, allGroups, allClients] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { permissionGroups: { select: { groupId: true } }, clientMemberships: { select: { clientId: true } } },
    }),
    viewerIsAdmin ? prisma.permissionGroup.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!user) {
    notFound();
  }

  const memberGroupIds = new Set(user.permissionGroups.map((m) => m.groupId));
  const memberClientIds = new Set(user.clientMemberships.map((m) => m.clientId));
  const updateUserForId = updateUser.bind(null, user.id);
  const deleteUserForId = deleteUser.bind(null, user.id);
  const setGroupsForUser = setUserPermissionGroups.bind(null, user.id);
  const setClientsForUser = setUserClientMemberships.bind(null, user.id);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">{user.name}</h1>
      <p className="mt-[3px] text-[13.5px] text-fg-muted">{user.email}</p>

      <Card className="mt-6 p-6">
        <ActionForm action={updateUserForId} className="space-y-4">
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
        </ActionForm>
      </Card>

      {viewerIsAdmin && (
        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-[13.5px] font-semibold text-fg">Permission groups</h2>
          </CardHeader>
          {allGroups.length === 0 ? (
            <p className="px-5 py-6 text-sm text-fg-muted">
              No permission groups exist yet. Create one on the{" "}
              <a href="/admin/permission-groups" className="text-accent hover:underline">
                Permission Groups
              </a>{" "}
              page.
            </p>
          ) : (
            <ActionForm action={setGroupsForUser} className="flex flex-col gap-3 p-5">
              <div className="flex flex-col gap-2">
                {allGroups.map((group) => (
                  <label key={group.id} className="flex items-center gap-2.5 text-sm text-fg-muted">
                    <input
                      type="checkbox"
                      name="groupIds"
                      value={group.id}
                      defaultChecked={memberGroupIds.has(group.id)}
                      className="rounded border-border-strong accent-accent"
                    />
                    {group.name}
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Save groups
                </Button>
              </div>
            </ActionForm>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">{labels.clients}</h2>
        </CardHeader>
        <p className="border-b border-border px-5 py-3 text-xs text-fg-subtle">
          Restricts which {labels.clients.toLowerCase()}&apos; tickets this user can see and be assigned —
          leave unchecked entirely to leave this user unrestricted (sees every {labels.client.toLowerCase()}).
        </p>
        {allClients.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">
            No {labels.clients.toLowerCase()} exist yet.
          </p>
        ) : (
          <ActionForm action={setClientsForUser} className="flex flex-col gap-3 p-5">
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {allClients.map((client) => (
                <label key={client.id} className="flex items-center gap-2.5 text-sm text-fg-muted">
                  <input
                    type="checkbox"
                    name="clientIds"
                    value={client.id}
                    defaultChecked={memberClientIds.has(client.id)}
                    className="rounded border-border-strong accent-accent"
                  />
                  {client.name}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm">
                Save {labels.clients.toLowerCase()}
              </Button>
            </div>
          </ActionForm>
        )}
      </Card>

      <div className="mt-6 flex justify-end">
        <DeleteButton action={deleteUserForId} label="Delete user" />
      </div>
    </div>
  );
}
