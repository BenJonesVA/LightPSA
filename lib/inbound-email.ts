import { prisma } from "@/lib/prisma";

// Postmark's inbound-parse webhook payload shape, trimmed to the fields we
// actually read. See https://postmarkapp.com/developer/webhooks/inbound-webhook
export type PostmarkInboundPayload = {
  FromFull?: { Email?: string; Name?: string };
  From?: string;
  ToFull?: { Email?: string }[];
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
};

export type InboundEmailResult =
  | { handled: true; action: "created"; ticketId: number }
  | { handled: true; action: "commented"; ticketId: number }
  | { handled: false; reason: string };

// A reply to one of our own outbound notifications lands at
// ticket-{id}@<inbound domain>, because outbound mail sets that as
// Reply-To. Postmark's inbound address is a catch-all on that domain, so any
// local-part works — this is the only one we treat as "thread onto an
// existing ticket" rather than "file a new one."
const REPLY_ADDRESS_RE = /^ticket-(\d+)@/i;

// Used as the Reply-To on outbound client-facing ticket emails, so a client
// hitting "Reply" in their mail client naturally threads back onto the same
// ticket via findReplyTicketId() above, instead of creating a new one.
// Returns null (no Reply-To header set — mail just replies to EMAIL_FROM
// as before) until INBOUND_EMAIL_DOMAIN is actually configured, matching
// this app's pattern of features degrading honestly rather than emitting a
// broken address by default.
export function ticketReplyToAddress(ticketId: number): string | undefined {
  const domain = process.env.INBOUND_EMAIL_DOMAIN;
  return domain ? `ticket-${ticketId}@${domain}` : undefined;
}

function findReplyTicketId(payload: PostmarkInboundPayload): number | null {
  for (const to of payload.ToFull ?? []) {
    const match = to.Email?.match(REPLY_ADDRESS_RE);
    if (match) return Number(match[1]);
  }
  return null;
}

function bodyText(payload: PostmarkInboundPayload): string {
  // StrippedTextReply is Postmark's best-effort "just the new text, not the
  // quoted history" extraction — exactly what we want for both a fresh
  // ticket description and a threaded reply. Fall back to the full body for
  // providers/payloads that don't populate it.
  return (payload.StrippedTextReply || payload.TextBody || "").trim();
}

export async function processInboundEmail(
  payload: PostmarkInboundPayload
): Promise<InboundEmailResult> {
  const senderEmail = (payload.FromFull?.Email || payload.From || "").trim().toLowerCase();
  if (!senderEmail) {
    return { handled: false, reason: "no sender address on inbound payload" };
  }

  const contact = await prisma.contact.findUnique({ where: { email: senderEmail } });
  if (!contact || !contact.isActive) {
    // We can't attribute this mail to a client we can trust, so there's no
    // ticket to write an honest-failure comment onto (unlike the outbound
    // email slice, which always has a ticket in hand). Visibility for an
    // unrecognized sender is therefore server logs, not app data.
    return { handled: false, reason: `unrecognized or inactive sender: ${senderEmail}` };
  }

  const replyTicketId = findReplyTicketId(payload);
  if (replyTicketId !== null) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: replyTicketId },
      select: { id: true, clientId: true },
    });
    // From: headers are trivially spoofable, so a match on the reply address
    // alone isn't enough authorization to post into any ticket by guessing
    // its id. Requiring the sender's own Contact record to belong to the
    // same client as the ticket keeps a spoofed From header from letting one
    // client's inbox post comments onto another client's ticket. It does not
    // defend against someone forging mail as an *existing* contact of the
    // *correct* client — that's a real, documented limitation of trusting
    // From headers at all, same as most inbound email parsers.
    if (!ticket || ticket.clientId !== contact.clientId) {
      return {
        handled: false,
        reason: `reply referenced ticket ${replyTicketId}, but it doesn't exist or isn't ${senderEmail}'s client`,
      };
    }

    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        body: bodyText(payload) || "(empty reply body)",
        isInternal: false,
        authorContactId: contact.id,
      },
    });

    return { handled: true, action: "commented", ticketId: ticket.id };
  }

  const board =
    (await prisma.board.findFirst({ where: { name: "Support" } })) ??
    (await prisma.board.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }));
  if (!board) {
    return { handled: false, reason: "no board available to file the new ticket against" };
  }

  const ticket = await prisma.ticket.create({
    data: {
      title: payload.Subject?.trim() || `Email from ${contact.firstName} ${contact.lastName}`,
      description: bodyText(payload) || "(empty message body)",
      source: "EMAIL",
      boardId: board.id,
      clientId: contact.clientId,
      contactId: contact.id,
    },
  });

  return { handled: true, action: "created", ticketId: ticket.id };
}
