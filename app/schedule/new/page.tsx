import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { createVisit } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] as const;

export default async function NewScheduledVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ ticketId?: string }>;
}) {
  await requireStaff();
  const { ticketId } = await searchParams;

  const [tickets, technicians] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { in: [...OPEN_STATUSES] } },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">Schedule a visit</h1>

      <Card className="mt-6 p-6">
        <form action={createVisit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">Ticket</label>
            <select
              name="ticketId"
              required
              defaultValue={ticketId ?? ""}
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            >
              <option value="">Select a ticket</option>
              {tickets.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  TKT-{ticket.id} · {ticket.client.name} · {ticket.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Technician</label>
            <select
              name="technicianId"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            >
              <option value="">Select a technician</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted">Start</label>
              <input
                type="datetime-local"
                name="startTime"
                required
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted">End</label>
              <input
                type="datetime-local"
                name="endTime"
                required
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Location</label>
            <input
              type="text"
              name="location"
              placeholder="Optional — e.g. client site address"
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div className="flex justify-end gap-3">
            <a href="/schedule">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Schedule visit
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
