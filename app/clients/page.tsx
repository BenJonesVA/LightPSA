import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TicketStatus, UserRole } from "@prisma/client";
import { requireStaff } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const ACTIVE_TICKET_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_ON_CLIENT,
];

export default async function ClientsPage() {
  const staff = await requireStaff();
  const canManage = staff.role === UserRole.ADMIN || staff.role === UserRole.MANAGER;

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      parent: { select: { name: true } },
      _count: {
        select: {
          contacts: true,
          tickets: { where: { status: { in: ACTIVE_TICKET_STATUSES } } },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Clients</h1>
        {canManage && (
          <Link href="/clients/new">
            <Button variant="primary">
              <span className="text-[15px] leading-none">+</span>New client
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Parent company</th>
              <th className="px-4 py-2.5">Contacts</th>
              <th className="px-4 py-2.5">Active tickets</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                <td className="px-4 py-row-py">
                  <Link href={`/clients/${client.id}`} className="font-medium text-fg hover:text-accent">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-row-py text-fg-muted">{client.parent?.name ?? "—"}</td>
                <td className="px-4 py-row-py text-fg-muted">{client._count.contacts}</td>
                <td className="px-4 py-row-py text-fg-muted">{client._count.tickets}</td>
                <td className="px-4 py-row-py">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      client.isActive ? "text-green bg-green-bg" : "text-slate bg-slate-bg"
                    }`}
                  >
                    <span className={`h-[7px] w-[7px] rounded-full ${client.isActive ? "bg-green" : "bg-slate"}`} />
                    {client.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-subtle">
                  No clients yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
