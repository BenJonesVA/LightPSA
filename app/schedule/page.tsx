import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { cancelVisit } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DAY_MS = 86_400_000;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

// Local-time Y-M-D, not toISOString() — that converts to UTC first and can
// shift the date across a midnight boundary depending on server timezone.
function dateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; technicianId?: string }>;
}) {
  await requireStaff();

  const { week, technicianId } = await searchParams;
  const anchor = week && !Number.isNaN(Date.parse(week)) ? new Date(week) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const prevWeek = dateParam(new Date(weekStart.getTime() - 7 * DAY_MS));
  const nextWeek = dateParam(new Date(weekStart.getTime() + 7 * DAY_MS));

  const [visits, technicians] = await Promise.all([
    prisma.scheduledVisit.findMany({
      where: {
        startTime: { gte: weekStart, lt: weekEnd },
        ...(technicianId ? { technicianId } : {}),
      },
      include: {
        ticket: { select: { id: true, title: true, client: { select: { name: true } } } },
        technician: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getTime() + i * DAY_MS);
    const dayVisits = visits.filter((v) => v.startTime >= date && v.startTime < new Date(date.getTime() + DAY_MS));
    return { date, visits: dayVisits };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Schedule</h1>
        <Link href="/schedule/new">
          <Button variant="primary">
            <span className="text-[15px] leading-none">+</span>New visit
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/schedule?week=${prevWeek}${technicianId ? `&technicianId=${technicianId}` : ""}`}>
            <Button variant="secondary" size="sm">
              ← Prev week
            </Button>
          </Link>
          <span className="px-2 text-[13px] font-medium text-fg-muted">
            {weekStart.toLocaleDateString("en-US", DATE_FORMAT)} –{" "}
            {new Date(weekEnd.getTime() - DAY_MS).toLocaleDateString("en-US", DATE_FORMAT)}
          </span>
          <Link href={`/schedule?week=${nextWeek}${technicianId ? `&technicianId=${technicianId}` : ""}`}>
            <Button variant="secondary" size="sm">
              Next week →
            </Button>
          </Link>
        </div>

        <form method="get" className="flex items-end gap-2">
          <input type="hidden" name="week" value={dateParam(weekStart)} />
          <div>
            <label className="mb-[6px] block text-xs font-medium text-fg-muted">Technician</label>
            <select
              name="technicianId"
              defaultValue={technicianId ?? ""}
              className="rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
            >
              <option value="">All</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
        {days.map(({ date, visits: dayVisits }) => (
          <Card key={date.toISOString()} className="flex min-h-[160px] flex-col p-0">
            <div className="border-b border-border bg-surface-2 px-3 py-2 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                {DAY_LABELS[date.getDay()]}
              </div>
              <div className="text-[13px] font-semibold text-fg">
                {date.toLocaleDateString("en-US", DATE_FORMAT)}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {dayVisits.length === 0 ? (
                <p className="px-1 py-2 text-center text-[11px] text-fg-subtle">—</p>
              ) : (
                dayVisits.map((visit) => (
                  <div key={visit.id} className="rounded-lg border border-border bg-surface-2 p-2 text-[11.5px]">
                    <div className="font-semibold text-fg">
                      {visit.startTime.toLocaleTimeString("en-US", TIME_FORMAT)} –{" "}
                      {visit.endTime.toLocaleTimeString("en-US", TIME_FORMAT)}
                    </div>
                    <Link href={`/tickets/${visit.ticket.id}`} className="block truncate text-fg-muted hover:text-accent">
                      TKT-{visit.ticket.id} · {visit.ticket.title}
                    </Link>
                    <div className="mt-1 flex items-center justify-between text-fg-subtle">
                      <span className="truncate">{visit.technician.name}</span>
                      <form action={cancelVisit.bind(null, visit.id, visit.ticketId)}>
                        <button type="submit" className="text-red hover:underline">
                          Cancel
                        </button>
                      </form>
                    </div>
                    {visit.location && <div className="mt-0.5 truncate text-fg-subtle">{visit.location}</div>}
                  </div>
                ))
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
