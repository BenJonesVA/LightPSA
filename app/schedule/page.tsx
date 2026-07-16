import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { cancelVisit } from "./actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DAY_MS = 86_400_000;
const AGENDA_DAYS = 30;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
const DAY_TITLE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
};
const AGENDA_GROUP_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "short",
  day: "numeric",
};

type View = "week" | "month" | "day" | "agenda";
const VIEWS: View[] = ["week", "month", "day", "agenda"];
const TABS: { key: View; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "day", label: "Day" },
  { key: "agenda", label: "Agenda" },
];

type VisitWithRelations = Prisma.ScheduledVisitGetPayload<{
  include: {
    ticket: { select: { id: true; title: true; client: { select: { name: true } } } };
    technician: { select: { name: true } };
  };
}>;

// Local-time Y-M-D, not toISOString() — that converts to UTC first and can
// shift the date across a midnight boundary depending on server timezone.
function dateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parses a "YYYY-MM-DD" query param as a local-time date. Date-only strings
// passed to `new Date(...)` are parsed as UTC midnight per spec, which can
// land on the previous local day in negative-offset timezones — breaking
// prev/next navigation round-trips. Falls back to "now" if absent/invalid.
function parseLocalDate(s: string | undefined): Date {
  const match = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
}

function startOfWeek(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function startOfDay(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// setDate-based so day/month rollovers (and DST) are handled by the Date
// object itself rather than raw millisecond math.
function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function scheduleHref(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `/schedule?${qs}` : "/schedule";
}

function VisitRow({ visit }: { visit: VisitWithRelations }) {
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-[100px] shrink-0 text-[13px] font-semibold text-fg">
          {visit.startTime.toLocaleTimeString("en-US", TIME_FORMAT)} –{" "}
          {visit.endTime.toLocaleTimeString("en-US", TIME_FORMAT)}
        </div>
        <div className="min-w-0">
          <Link
            href={`/tickets/${visit.ticket.id}`}
            className="block truncate text-[13.5px] font-medium text-fg hover:text-accent"
          >
            TKT-{visit.ticket.id} · {visit.ticket.title}
          </Link>
          <div className="truncate text-[12px] text-fg-subtle">
            {visit.ticket.client.name} · {visit.technician.name}
            {visit.location ? ` · ${visit.location}` : ""}
          </div>
        </div>
      </div>
      <form action={cancelVisit.bind(null, visit.id, visit.ticketId)}>
        <button type="submit" className="shrink-0 text-[12.5px] text-red hover:underline">
          Cancel
        </button>
      </form>
    </Card>
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string; date?: string; technicianId?: string }>;
}) {
  await requireStaff();

  const { view: viewParam, week, date: dateStr, technicianId } = await searchParams;
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : "week";

  // Week view keeps its own `week` anchor param (unchanged, for back-compat
  // with existing bookmarks/links). Month/Day/Agenda share a `date` anchor.
  const weekAnchor = parseLocalDate(week);
  const dateAnchor = parseLocalDate(dateStr);

  const weekStart = startOfWeek(weekAnchor);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const prevWeek = dateParam(new Date(weekStart.getTime() - 7 * DAY_MS));
  const nextWeek = dateParam(new Date(weekStart.getTime() + 7 * DAY_MS));

  const monthStart = startOfMonth(dateAnchor);
  const monthEndExclusive = addMonths(monthStart, 1);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(addDays(monthEndExclusive, -1)), 7);
  const prevMonth = dateParam(addMonths(monthStart, -1));
  const nextMonth = dateParam(addMonths(monthStart, 1));

  const dayStart = startOfDay(dateAnchor);
  const dayEnd = addDays(dayStart, 1);
  const prevDay = dateParam(addDays(dayStart, -1));
  const nextDay = dateParam(addDays(dayStart, 1));

  const agendaEnd = addDays(dayStart, AGENDA_DAYS);
  const prevAgenda = dateParam(addDays(dayStart, -AGENDA_DAYS));
  const nextAgenda = dateParam(addDays(dayStart, AGENDA_DAYS));

  let queryStart = weekStart;
  let queryEnd = weekEnd;
  if (view === "month") {
    queryStart = gridStart;
    queryEnd = gridEnd;
  } else if (view === "day") {
    queryStart = dayStart;
    queryEnd = dayEnd;
  } else if (view === "agenda") {
    queryStart = dayStart;
    queryEnd = agendaEnd;
  }

  const [visits, technicians] = await Promise.all([
    prisma.scheduledVisit.findMany({
      where: {
        startTime: { gte: queryStart, lt: queryEnd },
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

  const focusDate = view === "week" ? weekStart : view === "month" ? monthStart : dayStart;

  function tabHref(key: View): string {
    if (key === "week") return scheduleHref({ view: key, week: dateParam(focusDate), technicianId });
    return scheduleHref({ view: key, date: dateParam(focusDate), technicianId });
  }

  // Week view data
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart.getTime() + i * DAY_MS);
    const dayVisits = visits.filter((v) => v.startTime >= date && v.startTime < new Date(date.getTime() + DAY_MS));
    return { date, visits: dayVisits };
  });

  // Month view data
  const gridDayCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY_MS);
  const monthDays = Array.from({ length: gridDayCount }, (_, i) => {
    const date = addDays(gridStart, i);
    const nextDate = addDays(date, 1);
    const dayVisits = visits.filter((v) => v.startTime >= date && v.startTime < nextDate);
    const inMonth = date.getMonth() === monthStart.getMonth() && date.getFullYear() === monthStart.getFullYear();
    return { date, visits: dayVisits, inMonth };
  });

  // Agenda view data — group the (already fetched) visits by calendar day.
  const agendaMap = new Map<string, { date: Date; visits: VisitWithRelations[] }>();
  for (const visit of visits) {
    const key = dateParam(visit.startTime);
    if (!agendaMap.has(key)) {
      agendaMap.set(key, { date: startOfDay(visit.startTime), visits: [] });
    }
    agendaMap.get(key)!.visits.push(visit);
  }
  const agendaGroups = Array.from(agendaMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

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

      <div className="flex items-center gap-2">
        {TABS.map((tab) => (
          <Link key={tab.key} href={tabHref(tab.key)}>
            <Button variant={view === tab.key ? "primary" : "secondary"} size="sm">
              {tab.label}
            </Button>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          {view === "week" && (
            <>
              <Link href={scheduleHref({ view: "week", week: prevWeek, technicianId })}>
                <Button variant="secondary" size="sm">
                  ← Prev week
                </Button>
              </Link>
              <span className="px-2 text-[13px] font-medium text-fg-muted">
                {weekStart.toLocaleDateString("en-US", DATE_FORMAT)} –{" "}
                {new Date(weekEnd.getTime() - DAY_MS).toLocaleDateString("en-US", DATE_FORMAT)}
              </span>
              <Link href={scheduleHref({ view: "week", week: nextWeek, technicianId })}>
                <Button variant="secondary" size="sm">
                  Next week →
                </Button>
              </Link>
            </>
          )}
          {view === "month" && (
            <>
              <Link href={scheduleHref({ view: "month", date: prevMonth, technicianId })}>
                <Button variant="secondary" size="sm">
                  ← Prev month
                </Button>
              </Link>
              <span className="px-2 text-[13px] font-medium text-fg-muted">
                {monthStart.toLocaleDateString("en-US", MONTH_FORMAT)}
              </span>
              <Link href={scheduleHref({ view: "month", date: nextMonth, technicianId })}>
                <Button variant="secondary" size="sm">
                  Next month →
                </Button>
              </Link>
            </>
          )}
          {view === "day" && (
            <>
              <Link href={scheduleHref({ view: "day", date: prevDay, technicianId })}>
                <Button variant="secondary" size="sm">
                  ← Prev day
                </Button>
              </Link>
              <span className="px-2 text-[13px] font-medium text-fg-muted">
                {dayStart.toLocaleDateString("en-US", DATE_FORMAT)}
              </span>
              <Link href={scheduleHref({ view: "day", date: nextDay, technicianId })}>
                <Button variant="secondary" size="sm">
                  Next day →
                </Button>
              </Link>
            </>
          )}
          {view === "agenda" && (
            <>
              <Link href={scheduleHref({ view: "agenda", date: prevAgenda, technicianId })}>
                <Button variant="secondary" size="sm">
                  ← Earlier
                </Button>
              </Link>
              <span className="px-2 text-[13px] font-medium text-fg-muted">
                {dayStart.toLocaleDateString("en-US", DATE_FORMAT)} –{" "}
                {new Date(agendaEnd.getTime() - DAY_MS).toLocaleDateString("en-US", DATE_FORMAT)}
              </span>
              <Link href={scheduleHref({ view: "agenda", date: nextAgenda, technicianId })}>
                <Button variant="secondary" size="sm">
                  Later →
                </Button>
              </Link>
            </>
          )}
        </div>

        <form method="get" className="flex items-end gap-2">
          <input type="hidden" name="view" value={view} />
          {view === "week" && <input type="hidden" name="week" value={dateParam(weekStart)} />}
          {view === "month" && <input type="hidden" name="date" value={dateParam(monthStart)} />}
          {(view === "day" || view === "agenda") && (
            <input type="hidden" name="date" value={dateParam(dayStart)} />
          )}
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

      {view === "week" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          {weekDays.map(({ date, visits: dayVisits }) => (
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
      )}

      {view === "month" && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-[11px] font-semibold uppercase tracking-wider text-fg-subtle"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map(({ date, visits: dayVisits, inMonth }) => (
              <Card
                key={date.toISOString()}
                className={`flex min-h-[110px] flex-col p-0 ${inMonth ? "" : "opacity-40"}`}
              >
                <div className="border-b border-border bg-surface-2 px-2 py-1">
                  <Link
                    href={scheduleHref({ view: "day", date: dateParam(date), technicianId })}
                    className="text-[12px] font-semibold text-fg hover:text-accent"
                  >
                    {date.getDate()}
                  </Link>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-1.5">
                  {dayVisits.slice(0, 3).map((visit) => (
                    <Link
                      key={visit.id}
                      href={`/tickets/${visit.ticket.id}`}
                      className="block truncate rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-fg-muted hover:text-accent"
                    >
                      <span className="font-semibold text-fg">
                        {visit.startTime.toLocaleTimeString("en-US", TIME_FORMAT)}
                      </span>{" "}
                      {visit.ticket.client.name}
                    </Link>
                  ))}
                  {dayVisits.length > 3 && (
                    <Link
                      href={scheduleHref({ view: "day", date: dateParam(date), technicianId })}
                      className="px-1.5 text-[10px] text-fg-subtle hover:text-accent"
                    >
                      +{dayVisits.length - 3} more
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-fg">
            {dayStart.toLocaleDateString("en-US", DAY_TITLE_FORMAT)}
          </h2>
          {visits.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-fg-subtle">No visits scheduled.</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {visits.map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </div>
          )}
        </div>
      )}

      {view === "agenda" && (
        <div className="flex flex-col gap-4">
          {agendaGroups.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-fg-subtle">
              No upcoming visits in this range.
            </Card>
          ) : (
            agendaGroups.map(({ date, visits: dayVisits }) => (
              <div key={date.toISOString()}>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-fg-subtle">
                  {date.toLocaleDateString("en-US", AGENDA_GROUP_FORMAT)}
                </div>
                <div className="flex flex-col gap-2">
                  {dayVisits.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
