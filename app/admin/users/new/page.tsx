import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { createUser } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ROLE_OPTIONS = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN] as const;

export default async function NewUserPage() {
  await requireRole(UserRole.ADMIN);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">New user</h1>

      <Card className="mt-6 p-6">
        <form action={createUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">Name</label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Title (optional)</label>
            <input
              name="title"
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Role</label>
            <select
              name="role"
              defaultValue={UserRole.TECHNICIAN}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
            <p className="mt-1 text-xs text-fg-subtle">At least 8 characters.</p>
          </div>

          <div className="flex justify-end gap-3">
            <a href="/admin/users">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Create user
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
