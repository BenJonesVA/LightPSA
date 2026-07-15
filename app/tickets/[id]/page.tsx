import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { addComment, updateTicketStatus, updateTicketPriority, logTime, logExpense } from "../actions";
import { getSlaStatus } from "@/lib/sla";
import { CannedResponsePicker } from "./canned-response-picker";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

const STATUS_OPTIONS: TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();

  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      board: true,
      client: true,
      contact: true,
      assignee: true,
      category: true,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { authorUser: true, authorContact: true },
      },
      timeLogs: true,
      expenses: true,
      csatResponse: true,
    },
  });

  if (!ticket) notFound();

  const [slaPolicy, cannedResponses] = await Promise.all([
    prisma.slaPolicy.findUnique({ where: { priority: ticket.priority } }),
    prisma.cannedResponse.findMany({
      where: { OR: [{ boardId: null }, { boardId: ticket.boardId }] },
      select: { id: true, title: true, body: true },
    }),
  ]);

  const sla =
    slaPolicy && slaPolicy.isActive && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED"
      ? getSlaStatus(ticket, slaPolicy)
      : null;

  async function changeStatus(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "");
    await updateTicketStatus(ticketId, status);
  }

  async function changePriority(formData: FormData) {
    "use server";
    await updateTicketPriority(ticketId, formData);
  }

  async function submitComment(formData: FormData) {
    "use server";
    await addComment(ticketId, formData);
  }

  async function submitTimeLog(formData: FormData) {
    "use server";
    await logTime(ticketId, formData);
  }

  async function submitExpense(formData: FormData) {
    "use server";
    await logExpense(ticketId, formData);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/tickets" className="text-sm text-fg-subtle hover:text-fg">
        ← Back to Tickets
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold leading-tight tracking-tight text-fg">
            TKT-{ticket.id} · {ticket.title}
          </h1>
          <div className="mt-[10px] flex flex-wrap items-center gap-[10px]">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs text-fg-subtle">Source: {ticket.source}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_296px] lg:items-start">
        {/* main column */}
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-fg">{ticket.description}</p>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Time logs
              </h2>
              {ticket.timeLogs.length === 0 ? (
                <p className="mt-2 text-[13px] text-fg-subtle">No time logged yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-grid text-[13px]">
                  {ticket.timeLogs.map((log) => (
                    <li key={log.id} className="flex items-center justify-between py-2">
                      <span className="text-fg-muted">
                        {log.durationMinutes} min · {log.workType}
                      </span>
                      <span className={log.billable ? "font-medium text-green" : "text-fg-subtle"}>
                        {log.billable ? "Billable" : "Non-billable"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <form action={submitTimeLog} className="mt-4 space-y-2 border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted">Duration (min)</label>
                    <input
                      type="number"
                      name="durationMinutes"
                      min={1}
                      required
                      className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted">Work type</label>
                    <select
                      name="workType"
                      defaultValue="REMOTE"
                      className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                    >
                      <option value="REMOTE">Remote</option>
                      <option value="ONSITE">Onsite</option>
                      <option value="ADMIN">Admin</option>
                      <option value="PROJECT">Project</option>
                    </select>
                  </div>
                </div>
                <textarea
                  name="notesInternal"
                  rows={2}
                  placeholder="Internal notes…"
                  className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    <input type="checkbox" name="billable" defaultChecked />
                    Billable
                  </label>
                  <Button type="submit" variant="primary" size="sm">
                    Log time
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="p-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Expenses
              </h2>
              {ticket.expenses.length === 0 ? (
                <p className="mt-2 text-[13px] text-fg-subtle">No expenses logged yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-grid text-[13px]">
                  {ticket.expenses.map((expense) => (
                    <li key={expense.id} className="flex items-center justify-between py-2">
                      <span className="text-fg-muted">
                        {expense.type} · ${expense.amount.toString()}
                      </span>
                      <span className={expense.billable ? "font-medium text-green" : "text-fg-subtle"}>
                        {expense.billable ? "Billable" : "Non-billable"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <form action={submitExpense} className="mt-4 space-y-2 border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted">Type</label>
                    <select
                      name="type"
                      defaultValue="MATERIAL"
                      className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                    >
                      <option value="MILEAGE">Mileage</option>
                      <option value="MATERIAL">Material</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted">Amount ($)</label>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min={0.01}
                      required
                      className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted">Miles (if mileage)</label>
                  <input
                    type="number"
                    name="miles"
                    step="0.1"
                    min={0}
                    className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                  />
                </div>
                <input
                  name="description"
                  required
                  placeholder="Description…"
                  className="w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    <input type="checkbox" name="billable" defaultChecked />
                    Billable
                  </label>
                  <Button type="submit" variant="primary" size="sm">
                    Log expense
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Comments
            </h2>

            <ul className="mt-3 flex flex-col gap-3">
              {ticket.comments.map((comment) => {
                const authorName = comment.authorUser
                  ? comment.authorUser.name
                  : comment.authorContact
                    ? `${comment.authorContact.firstName} ${comment.authorContact.lastName}`
                    : "Unknown";
                return (
                  <li
                    key={comment.id}
                    className={`rounded-xl border p-3.5 text-sm ${
                      comment.isInternal ? "border-amber bg-amber-bg" : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-fg">{authorName}</span>
                      <div className="flex items-center gap-2">
                        {comment.isInternal ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-bg px-[7px] py-[1px] text-[10.5px] font-semibold text-amber">
                            Internal note
                          </span>
                        ) : null}
                        <span className="text-xs text-fg-subtle">{comment.createdAt.toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-fg-muted">{comment.body}</p>
                  </li>
                );
              })}
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-fg-subtle">No comments yet.</p>
              ) : null}
            </ul>

            <form action={submitComment} className="mt-4 space-y-2 border-t border-border pt-4">
              <CannedResponsePicker
                cannedResponses={cannedResponses}
                clientName={ticket.client.name}
                ticketId={ticket.id}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-fg-muted">
                  <input type="checkbox" name="isInternal" />
                  Internal note (hidden from client)
                </label>
                <Button type="submit" variant="primary">
                  Add comment
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* properties rail */}
        <div className="flex flex-col gap-4">
          {sla && (
            <Card className="p-[18px]">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                SLA — {ticket.priority}
              </div>
              <div className="flex flex-col gap-3 text-[12.5px]">
                <div>
                  <div className="font-semibold text-fg-muted">Response due</div>
                  <div className={sla.responseBreached ? "font-semibold text-red" : "text-fg"}>
                    {sla.responseDueAt.toLocaleString()}
                    {sla.responseBreached ? " — breached" : sla.firstResponseAt ? " — met" : ""}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-fg-muted">Resolution due</div>
                  <div className={sla.resolutionBreached ? "font-semibold text-red" : "text-fg"}>
                    {sla.resolutionDueAt.toLocaleString()}
                    {sla.resolutionBreached ? " — breached" : ""}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-[18px]">
            <CardHeader className="-mx-[18px] -mt-[18px] mb-[14px] px-[18px] text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Properties
            </CardHeader>
            <div className="flex flex-col gap-3 text-[12.5px]">
              <div>
                <div className="mb-1 font-medium text-fg-muted">Board</div>
                <div className="font-medium text-fg">{ticket.board.name}</div>
              </div>
              <div>
                <div className="mb-1 font-medium text-fg-muted">Assignee</div>
                <div className="font-medium text-fg">{ticket.assignee?.name ?? "Unassigned"}</div>
              </div>
              <div>
                <div className="mb-1 font-medium text-fg-muted">Category</div>
                <div className="font-medium text-fg">{ticket.category?.name ?? "—"}</div>
              </div>
              <div>
                <div className="mb-1 font-medium text-fg-muted">Submitted by</div>
                <div className="font-medium text-fg">
                  {ticket.contact ? `${ticket.contact.firstName} ${ticket.contact.lastName}` : "—"}
                </div>
              </div>
              <div>
                <div className="mb-1 font-medium text-fg-muted">Created</div>
                <div className="font-medium text-fg">{ticket.createdAt.toLocaleString()}</div>
              </div>
            </div>

            <form action={changeStatus} className="mt-4 flex items-end gap-2 border-t border-border pt-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-fg-muted">Status</label>
                <select
                  name="status"
                  defaultValue={ticket.status}
                  className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Update
              </Button>
            </form>

            <form action={changePriority} className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-fg-muted">Priority</label>
                <select
                  name="priority"
                  defaultValue={ticket.priority}
                  className="mt-1 w-full rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Update
              </Button>
            </form>
          </Card>

          {ticket.csatResponse && (
            <Card className="p-[18px]">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                Customer satisfaction
              </div>
              {ticket.csatResponse.respondedAt ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[20px] font-bold text-fg">{ticket.csatResponse.rating}/5</div>
                  {ticket.csatResponse.comment && (
                    <p className="text-[12.5px] text-fg-muted">&quot;{ticket.csatResponse.comment}&quot;</p>
                  )}
                </div>
              ) : (
                <p className="text-[12.5px] text-fg-subtle">
                  {ticket.csatResponse.sentAt
                    ? "Survey sent, awaiting response."
                    : ticket.contact
                      ? "Survey could not be sent — see internal comments for why."
                      : "Survey not sent — no client contact on file."}
                </p>
              )}
            </Card>
          )}

          <Card className="p-[18px]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              Client
            </div>
            <div className="text-[13px] font-semibold text-fg">{ticket.client.name}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
