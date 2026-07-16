import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function UsersAdminPage() {
  await requireRole(UserRole.ADMIN);

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Users</h1>
        <Link href="/admin/users/new">
          <Button variant="primary">
            <span className="text-[15px] leading-none">+</span>New user
          </Button>
        </Link>
      </div>

      {users.length === 0 ? (
        <Card className="px-5 py-6">
          <p className="text-sm text-fg-muted">No users yet. Create the first one.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-row-py font-medium text-fg">
                    <Link href={`/admin/users/${user.id}`} className="hover:text-accent">
                      {user.name}
                    </Link>
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">{user.email}</td>
                  <td className="px-4 py-row-py text-fg-muted">{user.title ?? "—"}</td>
                  <td className="px-4 py-row-py text-fg-muted">{user.role}</td>
                  <td className="px-4 py-row-py">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        user.isActive ? "text-green bg-green-bg" : "text-slate bg-slate-bg"
                      }`}
                    >
                      <span className={`h-[7px] w-[7px] rounded-full ${user.isActive ? "bg-green" : "bg-slate"}`} />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
