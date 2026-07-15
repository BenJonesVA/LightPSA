import Link from "next/link";
import { requireClientSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] as const;

export default async function PortalPage() {
  const user = await requireClientSession();

  const [client, openTickets] = await Promise.all([
    prisma.client.findUnique({ where: { id: user.clientId! } }),
    prisma.ticket.findMany({
      where: { clientId: user.clientId!, status: { in: [...OPEN_STATUSES] } },
      orderBy: { createdAt: "desc" },
      include: { board: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-fg">Welcome, {user.name}</h1>
          <p className="mt-1.5 text-[15px] text-fg-muted">{client?.name}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/portal/tickets" className="sm:w-auto">
            <Button variant="secondary" className="w-full justify-center px-6 py-3 text-[15px]">
              View all tickets
            </Button>
          </Link>
          <Link href="/portal/tickets/new" className="sm:w-auto">
            <Button variant="primary" className="w-full justify-center px-6 py-3 text-[15px]">
              Submit a ticket
            </Button>
          </Link>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="px-6 py-4">
          <h2 className="text-[15px] font-semibold text-fg">Open tickets ({openTickets.length})</h2>
        </CardHeader>
        {openTickets.length === 0 ? (
          <p className="px-6 py-10 text-center text-[15px] text-fg-muted">No open tickets.</p>
        ) : (
          <ul className="divide-y divide-grid">
            {openTickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/portal/tickets/${t.id}`}
                  className="flex flex-col gap-2 px-6 py-5 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-fg">
                      TKT-{t.id} — {t.title}
                    </div>
                    <div className="mt-1 text-[13px] text-fg-subtle">{t.board.name}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
