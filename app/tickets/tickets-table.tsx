"use client";

import { useState } from "react";
import Link from "next/link";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];

export type TicketRow = {
  id: number;
  title: string;
  boardName: string;
  clientName: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeName: string | null;
  createdAt: string;
  sla: { text: string; tone: "red" | "green" | "subtle" };
};

const SLA_TONE_CLASS: Record<TicketRow["sla"]["tone"], string> = {
  red: "text-red",
  green: "text-green",
  subtle: "text-fg-subtle",
};

export function TicketsTable({
  rows,
  bulkUpdate,
}: {
  rows: TicketRow[];
  bulkUpdate: (ticketIds: number[], formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkUpdate(formData: FormData) {
    setPending(true);
    try {
      await bulkUpdate(Array.from(selected), formData);
      setSelected(new Set());
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="overflow-x-auto">
      {selected.size > 0 && (
        <form
          action={applyBulkUpdate}
          className="flex flex-wrap items-end gap-3 border-b border-border bg-surface-2 px-4 py-3"
        >
          <span className="text-[13px] font-medium text-fg">{selected.size} selected</span>
          <div>
            <label className="mb-[4px] block text-[10.5px] font-medium text-fg-subtle">Set status</label>
            <select
              name="status"
              defaultValue=""
              className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[13px] text-fg"
            >
              <option value="">No change</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-[4px] block text-[10.5px] font-medium text-fg-subtle">Set priority</label>
            <select
              name="priority"
              defaultValue=""
              className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[13px] text-fg"
            >
              <option value="">No change</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? "Applying…" : "Apply"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </form>
      )}

      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            <th className="w-8 px-4 py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all tickets"
                className="rounded border-border-strong accent-accent"
              />
            </th>
            <th className="px-4 py-2.5">Ticket</th>
            <th className="px-4 py-2.5">Title</th>
            <th className="px-4 py-2.5">Board</th>
            <th className="px-4 py-2.5">Client</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Priority</th>
            <th className="px-4 py-2.5">SLA</th>
            <th className="px-4 py-2.5">Assignee</th>
            <th className="px-4 py-2.5">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ticket) => (
            <tr
              key={ticket.id}
              className={`border-b border-grid hover:bg-surface-2 ${selected.has(ticket.id) ? "bg-accent-weak" : ""}`}
            >
              <td className="px-4 py-row-py">
                <input
                  type="checkbox"
                  checked={selected.has(ticket.id)}
                  onChange={() => toggleOne(ticket.id)}
                  aria-label={`Select TKT-${ticket.id}`}
                  className="rounded border-border-strong accent-accent"
                />
              </td>
              <td className="px-4 py-row-py font-mono font-medium text-fg-muted">
                <Link href={`/tickets/${ticket.id}`} className="hover:text-accent">
                  #{ticket.id}
                </Link>
              </td>
              <td className="max-w-[280px] truncate px-4 py-row-py text-fg">
                <Link href={`/tickets/${ticket.id}`} className="hover:text-accent">
                  {ticket.title}
                </Link>
              </td>
              <td className="px-4 py-row-py text-fg-muted">{ticket.boardName}</td>
              <td className="px-4 py-row-py text-fg-muted">{ticket.clientName}</td>
              <td className="px-4 py-row-py">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-row-py">
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td className="px-4 py-row-py">
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${SLA_TONE_CLASS[ticket.sla.tone]}`}>
                  {ticket.sla.tone !== "subtle" && <span className={`h-[6px] w-[6px] rounded-[2px] ${ticket.sla.tone === "red" ? "bg-red" : "bg-green"}`} />}
                  {ticket.sla.text}
                </span>
              </td>
              <td className="px-4 py-row-py text-fg-muted">{ticket.assigneeName ?? "Unassigned"}</td>
              <td className="px-4 py-row-py text-fg-subtle">{new Date(ticket.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-fg-subtle">
                No tickets match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
