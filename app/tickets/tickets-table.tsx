"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const HOVER_DELAY_MS = 1000;

const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];

const UNASSIGNED_VALUE = "__unassigned__";

export type TicketRow = {
  id: number;
  title: string;
  boardName: string;
  clientName: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeName: string | null;
  createdAt: string;
  dueAt: string | null;
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
  bulkAssign,
  assignableUsers = [],
  clientLabel = "Client",
}: {
  rows: TicketRow[];
  bulkUpdate: (ticketIds: number[], formData: FormData) => Promise<void>;
  bulkAssign?: (ticketIds: number[], assigneeId: string | null) => Promise<void>;
  assignableUsers?: { id: string; name: string }[];
  clientLabel?: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);
  const [assignPending, setAssignPending] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{
    row: TicketRow;
    top: number;
    left: number;
  } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  function clearHoverTimeout() {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }

  function handleRowMouseEnter(row: TicketRow, event: React.MouseEvent<HTMLTableRowElement>) {
    clearHoverTimeout();
    const rect = event.currentTarget.getBoundingClientRect();
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverPreview({
        row,
        top: rect.bottom + 6,
        left: Math.min(rect.left, Math.max(0, window.innerWidth - 280)),
      });
      hoverTimeoutRef.current = null;
    }, HOVER_DELAY_MS);
  }

  function handleRowMouseLeave() {
    clearHoverTimeout();
    setHoverPreview(null);
  }

  function handleRowMouseDown() {
    // A click (checkbox toggle, link nav, etc.) shouldn't leave a hover card
    // pending or pop one up right after the interaction.
    clearHoverTimeout();
    setHoverPreview(null);
  }

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

  async function handleBulkAssign(event: React.ChangeEvent<HTMLSelectElement>) {
    if (!bulkAssign) return;
    const value = event.target.value;
    if (!value) return; // placeholder option — no selection made yet
    const assigneeId = value === UNASSIGNED_VALUE ? null : value;
    setAssignPending(true);
    try {
      await bulkAssign(Array.from(selected), assigneeId);
      setSelected(new Set());
      event.target.value = "";
    } finally {
      setAssignPending(false);
    }
  }

  return (
    <>
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
          {bulkAssign && (
            <div>
              <label className="mb-[4px] block text-[10.5px] font-medium text-fg-subtle">Assign to…</label>
              <select
                defaultValue=""
                disabled={assignPending}
                onChange={handleBulkAssign}
                className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-[13px] text-fg"
              >
                <option value="">Choose assignee…</option>
                <option value={UNASSIGNED_VALUE}>Unassigned</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            {pending ? "Applying…" : "Apply"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
          {assignPending && <span className="text-[12px] text-fg-subtle">Assigning…</span>}
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
            <th className="px-4 py-2.5">{clientLabel}</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Priority</th>
            <th className="px-4 py-2.5">SLA</th>
            <th className="px-4 py-2.5">Assignee</th>
            <th className="px-4 py-2.5">Due</th>
            <th className="px-4 py-2.5">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ticket) => (
            <tr
              key={ticket.id}
              className={`border-b border-grid hover:bg-surface-2 ${selected.has(ticket.id) ? "bg-accent-weak" : ""}`}
              onMouseEnter={(e) => handleRowMouseEnter(ticket, e)}
              onMouseLeave={handleRowMouseLeave}
              onMouseDown={handleRowMouseDown}
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
              <td className="px-4 py-row-py">
                {ticket.dueAt ? (
                  <span
                    className={
                      ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && new Date(ticket.dueAt) < new Date()
                        ? "font-semibold text-red"
                        : "text-fg-muted"
                    }
                  >
                    {new Date(ticket.dueAt).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
              <td className="px-4 py-row-py text-fg-subtle">{new Date(ticket.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-fg-subtle">
                No tickets match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>

    {hoverPreview && (
      <Card
        role="tooltip"
        className="pointer-events-none fixed z-50 w-64 p-3 shadow-lg"
        style={{ top: hoverPreview.top, left: hoverPreview.left }}
      >
        <div className="mb-1.5 truncate text-[13px] font-semibold text-fg">
          {hoverPreview.row.title}
        </div>
        <div className="flex flex-col gap-1.5 text-[12.5px]">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge status={hoverPreview.row.status} />
            <PriorityBadge priority={hoverPreview.row.priority} />
          </div>
          <div className="text-fg-muted">
            <span className="text-fg-subtle">{clientLabel}:</span> {hoverPreview.row.clientName}
          </div>
          <div className="text-fg-muted">
            <span className="text-fg-subtle">Assignee:</span>{" "}
            {hoverPreview.row.assigneeName ?? "Unassigned"}
          </div>
        </div>
      </Card>
    )}
    </>
  );
}
