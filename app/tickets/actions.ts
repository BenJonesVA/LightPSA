"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TicketPriority, TicketStatus, WorkType, ExpenseType } from "@prisma/client";
import { runAutomationRules, isPriorityEscalation } from "@/lib/automation";
import { triggerCsatSurvey } from "@/lib/csat";

export async function createTicket(formData: FormData) {
  await requireStaff();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const priority = String(formData.get("priority") ?? "MEDIUM") as TicketPriority;
  const categoryId = formData.get("categoryId") ? String(formData.get("categoryId")) : null;

  if (!title || !boardId || !clientId) {
    throw new Error("Title, board, and client are required.");
  }

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description,
      boardId,
      clientId,
      priority,
      categoryId,
      source: "MANUAL",
    },
  });

  await runAutomationRules(ticket, "TICKET_CREATED");

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function addComment(ticketId: number, formData: FormData) {
  const user = await requireStaff();

  const body = String(formData.get("body") ?? "").trim();
  const isInternal = formData.get("isInternal") === "on";

  if (!body) return;

  await prisma.ticketComment.create({
    data: {
      ticketId,
      body,
      isInternal,
      authorUserId: user.id,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  redirect(`/tickets/${ticketId}`);
}

export async function updateTicketStatus(ticketId: number, status: string) {
  await requireStaff();

  const newStatus = status as TicketStatus;
  const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
  if (!current) return;

  // resolvedAt/closedAt are stamped here, not left to whoever reads them —
  // getSlaStatus, the dashboard breach count, and /reports all treat a null
  // resolvedAt as "still open," so this is the actual source of truth for
  // those fields, not just a display nicety. Reopening a ticket clears both:
  // a ticket that's back in progress isn't "resolved" anymore, even if it
  // was earlier. undefined (not null) is used when the resolved/closed state
  // isn't changing, so an already-stamped timestamp isn't reset by a
  // redundant same-status update or a later RESOLVED -> CLOSED transition.
  const wasResolvedOrClosed = current.status === "RESOLVED" || current.status === "CLOSED";
  const isResolvedOrClosed = newStatus === "RESOLVED" || newStatus === "CLOSED";
  const now = new Date();

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: newStatus,
      resolvedAt: isResolvedOrClosed ? (wasResolvedOrClosed ? undefined : now) : null,
      closedAt: newStatus === "CLOSED" ? (current.status === "CLOSED" ? undefined : now) : null,
    },
  });

  await runAutomationRules(updated, "STATUS_CHANGED");

  if (newStatus === "CLOSED" && current.status !== "CLOSED") {
    await triggerCsatSurvey(updated);
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function updateTicketPriority(ticketId: number, formData: FormData) {
  await requireStaff();

  const newPriority = String(formData.get("priority") ?? "") as TicketPriority;
  if (!newPriority) return;

  const current = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { priority: true },
  });
  if (!current) return;

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: { priority: newPriority },
  });

  if (isPriorityEscalation(current.priority, newPriority)) {
    await runAutomationRules(updated, "PRIORITY_ESCALATED");
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function logTime(ticketId: number, formData: FormData) {
  const user = await requireStaff();

  const durationMinutes = Number(formData.get("durationMinutes"));
  const workType = String(formData.get("workType") ?? "REMOTE") as WorkType;
  const billable = formData.get("billable") === "on";
  const notesInternal = String(formData.get("notesInternal") ?? "").trim() || null;

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return;

  await prisma.timeLog.create({
    data: {
      ticketId,
      userId: user.id,
      startTime: new Date(),
      durationMinutes,
      workType,
      billable,
      notesInternal,
      contractId: null,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function logExpense(ticketId: number, formData: FormData) {
  const user = await requireStaff();

  const type = String(formData.get("type") ?? "OTHER") as ExpenseType;
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const milesRaw = formData.get("miles");
  const miles = milesRaw ? Number(milesRaw) : null;
  const billable = formData.get("billable") === "on";

  if (!description || !Number.isFinite(amount) || amount <= 0) return;
  if (miles !== null && !Number.isFinite(miles)) return;

  await prisma.expense.create({
    data: {
      ticketId,
      userId: user.id,
      type,
      description,
      amount,
      miles: miles ?? undefined,
      billable,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
}
