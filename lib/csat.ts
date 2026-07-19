import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

type TicketForCsat = { id: number; title: string; contactId: string | null };

/**
 * Fires once, the moment a ticket closes — call site (updateTicketStatus) is
 * responsible for only calling this on the actual OPEN-state -> CLOSED
 * transition. The findUnique guard below is the real dedup though: it's what
 * keeps a reopen/close/reopen/close cycle from spamming the customer with a
 * fresh survey link every time, since a rule like that is easy to get wrong
 * at the call site and cheap to get right here.
 */
export async function triggerCsatSurvey(ticket: TicketForCsat): Promise<void> {
  const existing = await prisma.csatResponse.findUnique({ where: { ticketId: ticket.id } });
  if (existing) return;

  const csat = await prisma.csatResponse.create({ data: { ticketId: ticket.id } });

  // Fetched separately rather than widening TicketForCsat's shape — the
  // caller (updateTicketStatus) already passes exactly the fields it has to
  // hand, and this is the only site that needs assigneeId, purely to address
  // the internal Notification below.
  const assignee = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    select: { assigneeId: true },
  });

  async function notifyAssignee(message: string) {
    if (!assignee?.assigneeId) return;
    await prisma.notification.create({
      data: {
        userId: assignee.assigneeId,
        ticketId: ticket.id,
        type: "TICKET_UPDATED",
        message,
      },
    });
  }

  const contact = ticket.contactId
    ? await prisma.contact.findUnique({ where: { id: ticket.contactId }, select: { email: true } })
    : null;

  if (!contact?.email) {
    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        isInternal: true,
        body: `[CSAT] Ticket TKT-${ticket.id} closed, but there's no client contact on file to send a survey to.`,
      },
    });
    await notifyAssignee(`TKT-${ticket.id} closed — no client contact on file for a CSAT survey.`);
    return;
  }

  const baseUrl = process.env.APP_URL ?? "http://localhost:3131";
  const surveyUrl = `${baseUrl}/csat/${csat.id}`;
  const reopenUrl = `${baseUrl}/api/tickets/reopen?token=${csat.id}`;

  const result = await sendEmail({
    to: contact.email,
    subject: `How did we do on TKT-${ticket.id}: ${ticket.title}?`,
    html: `<p>Your ticket <strong>TKT-${ticket.id}: ${ticket.title}</strong> has been closed.</p><p>We'd appreciate a quick rating: <a href="${surveyUrl}">${surveyUrl}</a></p><p>Still having this issue? <a href="${reopenUrl}">Reopen this ticket</a>.</p>`,
  });

  await prisma.csatResponse.update({
    where: { id: csat.id },
    data: { sentAt: result.sent ? new Date() : null },
  });

  await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      isInternal: true,
      body: result.sent
        ? `[CSAT] Survey sent to ${contact.email}.`
        : `[CSAT] Tried to send a survey to ${contact.email} but it did not go out: ${result.reason}.`,
    },
  });

  await notifyAssignee(
    result.sent
      ? `TKT-${ticket.id} closed — CSAT survey sent to ${contact.email}.`
      : `TKT-${ticket.id} closed — CSAT survey to ${contact.email} did not go out.`
  );
}
