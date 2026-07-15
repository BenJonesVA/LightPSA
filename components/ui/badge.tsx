import type { TicketPriority, TicketStatus } from "@prisma/client";
import { formatDuration } from "@/lib/format";

const PRIORITY: Record<TicketPriority, { label: string; color: string }> = {
  LOW: { label: "Low", color: "bg-slate" },
  MEDIUM: { label: "Medium", color: "bg-amber" },
  HIGH: { label: "High", color: "bg-orange" },
  EMERGENCY: { label: "Emergency", color: "bg-red" },
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const p = PRIORITY[priority];
  return (
    <span className="inline-flex items-center gap-[7px] text-[12.5px] font-medium text-fg">
      <span className={`h-2 w-2 rounded-[2px] ${p.color}`} />
      {p.label}
    </span>
  );
}

const STATUS: Record<TicketStatus, { label: string; fg: string; bg: string; dot: string }> = {
  OPEN: { label: "Open", fg: "text-blue", bg: "bg-blue-bg", dot: "bg-blue" },
  IN_PROGRESS: { label: "In Progress", fg: "text-violet", bg: "bg-violet-bg", dot: "bg-violet" },
  WAITING_ON_CLIENT: { label: "Waiting on Client", fg: "text-amber", bg: "bg-amber-bg", dot: "bg-amber" },
  RESOLVED: { label: "Resolved", fg: "text-green", bg: "bg-green-bg", dot: "bg-green" },
  CLOSED: { label: "Closed", fg: "text-slate", bg: "bg-slate-bg", dot: "bg-slate" },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.fg} ${s.bg}`}
    >
      <span className={`h-[7px] w-[7px] rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/**
 * Three-state SLA read: on-track (green) / at-risk (amber, due within an hour)
 * / breached (red). `breached` comes straight from lib/sla.ts's getSlaStatus —
 * this component never recomputes breach state itself, only the at-risk cutoff.
 */
export function SlaBadge({ dueAt, breached, now = new Date() }: { dueAt: Date; breached: boolean; now?: Date }) {
  const remainingMs = dueAt.getTime() - now.getTime();
  const atRisk = !breached && remainingMs < 60 * 60_000;
  const color = breached ? "text-red" : atRisk ? "text-amber" : "text-green";
  const dot = breached ? "bg-red" : atRisk ? "bg-amber" : "bg-green";
  const label = breached ? `Breached · ${formatDuration(remainingMs)}` : formatDuration(remainingMs);

  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${color}`}>
      <span className={`h-[7px] w-[7px] rounded-[2px] ${dot}`} />
      {label}
    </span>
  );
}
