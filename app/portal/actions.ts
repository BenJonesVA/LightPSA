"use server";

import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import type { TicketPriority } from "@prisma/client";
import { saveAttachmentFile, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_MB } from "@/lib/storage";
import { escapePlainTextToHtml, sanitizeRichText } from "@/lib/sanitize-html";

export async function createPortalTicket(formData: FormData) {
  const user = await requireClientSession();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM") as TicketPriority;

  if (!title) {
    throw new Error("Title is required.");
  }

  // The submitting board is chosen server-side — a portal contact must never
  // be able to file directly onto an internal-only board.
  const board =
    (await prisma.board.findFirst({ where: { name: "Support" } })) ??
    (await prisma.board.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }));

  if (!board) {
    throw new Error("No board is available to file this ticket against.");
  }

  // Plain-textarea submission: escape to inert HTML first (belt), then run
  // through the same sanitizer every other write path uses (suspenders).
  const descriptionHtml = sanitizeRichText(escapePlainTextToHtml(description));

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description: descriptionHtml,
      priority,
      source: "PORTAL",
      boardId: board.id,
      clientId: user.clientId!,
      contactId: user.id,
    },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/tickets");
  redirect(`/portal/tickets/${ticket.id}`);
}

export async function addPortalComment(ticketId: number, formData: FormData) {
  const user = await requireClientSession();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  // Re-verify ownership on every action call — a page render having scoped
  // the ticket earlier doesn't guarantee this invocation is for the same,
  // still-owned ticket.
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: user.clientId! },
    select: { id: true },
  });
  if (!ticket) notFound();

  await prisma.ticketComment.create({
    data: {
      ticketId,
      body,
      isInternal: false,
      authorContactId: user.id,
    },
  });

  revalidatePath(`/portal/tickets/${ticketId}`);
  redirect(`/portal/tickets/${ticketId}`);
}

export async function uploadPortalAttachment(ticketId: number, formData: FormData) {
  const user = await requireClientSession();

  // Re-verify ownership here too, same as addPortalComment above — a page
  // render having scoped the ticket earlier doesn't guarantee this
  // invocation is for the same, still-owned ticket.
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: user.clientId! },
    select: { id: true },
  });
  if (!ticket) notFound();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`File exceeds the ${MAX_ATTACHMENT_MB}MB limit.`);
  }

  const attachment = await prisma.attachment.create({
    data: {
      ticketId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      isInternal: false, // portal uploads can never be internal-only — forced server-side
      uploadedByContactId: user.id,
    },
  });

  await saveAttachmentFile(attachment.id, Buffer.from(await file.arrayBuffer()));

  revalidatePath(`/portal/tickets/${ticketId}`);
}
