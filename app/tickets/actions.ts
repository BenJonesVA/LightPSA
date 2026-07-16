"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TicketPriority, TicketStatus, WorkType, ExpenseType } from "@prisma/client";
import { runAutomationRules, isPriorityEscalation } from "@/lib/automation";
import { triggerCsatSurvey } from "@/lib/csat";
import { saveAttachmentFile, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_MB } from "@/lib/storage";

export async function createTicket(formData: FormData) {
  await requireStaff();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const priority = String(formData.get("priority") ?? "MEDIUM") as TicketPriority;
  const categoryId = formData.get("categoryId") ? String(formData.get("categoryId")) : null;
  const expensesEnabled = formData.get("expensesEnabled") === "on";

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
      expensesEnabled,
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
  const user = await requireStaff();

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

  // Audit trail: who changed it and from what, as an internal comment so it
  // doesn't show up as client-facing chatter (same isInternal semantics used
  // throughout this codebase).
  if (newStatus !== current.status) {
    await prisma.ticketComment.create({
      data: {
        ticketId,
        body: `Status changed from ${current.status.replace(/_/g, " ")} to ${newStatus.replace(/_/g, " ")} by ${user.name}.`,
        isInternal: true,
        authorUserId: user.id,
      },
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function updateTicketPriority(ticketId: number, formData: FormData) {
  const user = await requireStaff();

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

  if (newPriority !== current.priority) {
    await prisma.ticketComment.create({
      data: {
        ticketId,
        body: `Priority changed from ${current.priority} to ${newPriority} by ${user.name}.`,
        isInternal: true,
        authorUserId: user.id,
      },
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function bulkUpdateTickets(ticketIds: number[], formData: FormData) {
  await requireStaff();

  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "");
  if (!status && !priority) return;

  // Reuse the single-ticket actions per id rather than a raw updateMany —
  // that's what keeps resolvedAt/closedAt stamping, automation triggers,
  // CSAT sends, and the audit-log comment all correct for a bulk change too,
  // instead of re-deriving that logic a second time here.
  for (const ticketId of ticketIds) {
    if (status) await updateTicketStatus(ticketId, status);
    if (priority) {
      const priorityFormData = new FormData();
      priorityFormData.set("priority", priority);
      await updateTicketPriority(ticketId, priorityFormData);
    }
  }

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

export async function startTimer(ticketId: number) {
  const user = await requireStaff();

  const existing = await prisma.timeLog.findFirst({
    where: { ticketId, userId: user.id, endTime: null },
  });
  if (existing) return; // already running for this user — idempotent, no duplicate open timers

  await prisma.timeLog.create({
    data: {
      ticketId,
      userId: user.id,
      startTime: new Date(),
      endTime: null,
      durationMinutes: 0,
      workType: "REMOTE",
      billable: true,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function stopTimer(ticketId: number) {
  const user = await requireStaff();

  const open = await prisma.timeLog.findFirst({
    where: { ticketId, userId: user.id, endTime: null },
  });
  if (!open) return;

  const endTime = new Date();
  const durationMinutes = Math.max(1, Math.round((endTime.getTime() - open.startTime.getTime()) / 60_000));

  await prisma.timeLog.update({
    where: { id: open.id },
    data: { endTime, durationMinutes },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function toggleExpensesEnabled(ticketId: number, formData: FormData) {
  await requireStaff();

  const expensesEnabled = formData.get("expensesEnabled") === "on";

  await prisma.ticket.update({ where: { id: ticketId }, data: { expensesEnabled } });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function uploadAttachment(ticketId: number, formData: FormData) {
  const user = await requireStaff();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`File exceeds the ${MAX_ATTACHMENT_MB}MB limit.`);
  }

  const isInternal = formData.get("isInternal") === "on";

  const attachment = await prisma.attachment.create({
    data: {
      ticketId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      isInternal,
      uploadedByUserId: user.id,
    },
  });

  await saveAttachmentFile(attachment.id, Buffer.from(await file.arrayBuffer()));

  revalidatePath(`/tickets/${ticketId}`);
}

export async function linkAsset(ticketId: number, formData: FormData) {
  await requireStaff();

  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) return;

  // upsert, not create — resubmitting the same link (e.g. a double-click)
  // is a no-op rather than a unique-constraint error.
  await prisma.ticketAsset.upsert({
    where: { ticketId_assetId: { ticketId, assetId } },
    update: {},
    create: { ticketId, assetId },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function unlinkAsset(ticketId: number, assetId: string) {
  await requireStaff();

  await prisma.ticketAsset.deleteMany({ where: { ticketId, assetId } });

  revalidatePath(`/tickets/${ticketId}`);
}
