import { prisma } from "@/lib/prisma";

// Reached from the "Still having this issue?" link in the CSAT survey email
// (lib/csat.ts). `token` is the CsatResponse id — same unguessable-token
// reasoning as the /csat/{id} survey link itself: it's already minted
// per-closure and only ever handed to the one contact that ticket's email
// went to, so it doubles as an auth-free reopen key for that same event.
//
// Writes directly via prisma (never through app/tickets/actions.ts, which is
// owned by another concurrent change) and leaves an internal audit-trail
// comment, matching this codebase's convention of always recording automated/
// client-triggered ticket changes as a TicketComment (see lib/csat.ts,
// lib/automation.ts, the SLA cron).
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return new Response("Missing token.", { status: 400 });
  }

  const csat = await prisma.csatResponse.findUnique({
    where: { id: token },
    select: { ticketId: true, ticket: { select: { title: true, assigneeId: true } } },
  });

  if (!csat) {
    return new Response("This reopen link is invalid or has expired.", { status: 404 });
  }

  await prisma.ticket.update({
    where: { id: csat.ticketId },
    data: { status: "OPEN" },
  });

  await prisma.ticketComment.create({
    data: {
      ticketId: csat.ticketId,
      isInternal: true,
      body: `[CSAT] Client reopened TKT-${csat.ticketId} via the "still having this issue?" survey link.`,
    },
  });

  if (csat.ticket.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: csat.ticket.assigneeId,
        ticketId: csat.ticketId,
        type: "TICKET_UPDATED",
        message: `TKT-${csat.ticketId}: ${csat.ticket.title} was reopened by the client.`,
      },
    });
  }

  return new Response(
    `Thanks — TKT-${csat.ticketId}: ${csat.ticket.title} has been reopened and our team has been notified. You can close this tab.`,
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
