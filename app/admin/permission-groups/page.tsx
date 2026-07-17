import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getOrgLabels } from "@/lib/settings";
import { getPermissionCatalog } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { DeleteButton } from "@/components/ui/delete-button";
import { createPermissionGroup, updatePermissionGroup, deletePermissionGroup } from "./actions";

const inputClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";

function PermissionCheckboxes({
  catalog,
  checked,
}: {
  catalog: ReturnType<typeof getPermissionCatalog>;
  checked: Set<string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {catalog.map((perm) => (
        <label key={perm.key} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 text-[12.5px]">
          <input
            type="checkbox"
            name="permissions"
            value={perm.key}
            defaultChecked={checked.has(perm.key)}
            className="mt-0.5 rounded border-border-strong accent-accent"
          />
          <span>
            <span className="block font-medium text-fg">{perm.label}</span>
            <span className="block text-fg-subtle">{perm.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default async function PermissionGroupsAdminPage() {
  await requireRole(UserRole.ADMIN);

  const labels = await getOrgLabels();
  const catalog = getPermissionCatalog(labels);

  const groups = await prisma.permissionGroup.findMany({
    orderBy: { name: "asc" },
    include: { members: { select: { user: { select: { id: true, name: true } } } } },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Permission Groups</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Named bundles of extra capabilities. Assigning a user to a group only ever grants
          capabilities on top of their role — it never restricts what ADMIN/MANAGER already have.
          Assign users to groups from a user&apos;s edit page.
        </p>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-[15px] font-semibold text-fg">New group</h2>
        <ActionForm action={createPermissionGroup} className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Name</span>
            <input type="text" name="name" required className={`w-full ${inputClass}`} placeholder="e.g. Board Managers" />
          </label>
          <PermissionCheckboxes catalog={catalog} checked={new Set()} />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm">
              Create group
            </Button>
          </div>
        </ActionForm>
      </Card>

      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <Card key={group.id} className="p-4">
            <ActionForm action={updatePermissionGroup.bind(null, group.id)} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={group.name}
                  className={`flex-1 ${inputClass}`}
                />
                <span className="whitespace-nowrap text-[11.5px] text-fg-subtle">
                  {group.members.length === 0
                    ? "No members"
                    : `${group.members.length} member${group.members.length === 1 ? "" : "s"}`}
                </span>
              </div>
              <PermissionCheckboxes catalog={catalog} checked={new Set(group.permissions)} />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Save
                </Button>
              </div>
            </ActionForm>
            <div className="mt-3 flex justify-end border-t border-border pt-3">
              <DeleteButton action={deletePermissionGroup.bind(null, group.id)} label="Delete group" />
            </div>
          </Card>
        ))}
        {groups.length === 0 && <Card className="p-8 text-center text-fg-subtle">No permission groups yet.</Card>}
      </div>
    </div>
  );
}
