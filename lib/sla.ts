import type { SlaPolicy, TicketComment, TicketStatus } from "@prisma/client";

export type SlaStatus = {
  responseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseAt: Date | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
};

type TicketForSla = {
  status: TicketStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  waitingSince: Date | null;
  totalWaitMinutes: number;
  comments: Pick<TicketComment, "createdAt" | "authorUserId" | "isInternal">[];
};

/**
 * Minutes the resolution clock should be pushed back by: time already
 * banked from prior WAITING_ON_CLIENT stints, plus (if the ticket is in that
 * state right now) time elapsed since it entered it. Only the resolution
 * clock pauses — first response has normally already happened by the time a
 * ticket moves to WAITING_ON_CLIENT, so that clock isn't extended.
 */
function getPausedMinutes(ticket: TicketForSla, now: Date): number {
  const ongoing =
    ticket.status === "WAITING_ON_CLIENT" && ticket.waitingSince
      ? Math.floor((now.getTime() - ticket.waitingSince.getTime()) / 60_000)
      : 0;
  return ticket.totalWaitMinutes + ongoing;
}

/**
 * First response = the earliest client-visible (isInternal: false) comment
 * authored by staff (authorUserId set). An internal note doesn't count as
 * having responded to the client, regardless of how fast it was written.
 */
function getFirstResponseAt(ticket: TicketForSla): Date | null {
  const staffPublicComments = ticket.comments
    .filter((c) => c.authorUserId !== null && !c.isInternal)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return staffPublicComments[0]?.createdAt ?? null;
}

export function getSlaStatus(
  ticket: TicketForSla,
  policy: Pick<SlaPolicy, "responseTargetMinutes" | "resolutionTargetMinutes">,
  now: Date = new Date()
): SlaStatus {
  const pausedMinutes = getPausedMinutes(ticket, now);
  const responseDueAt = new Date(ticket.createdAt.getTime() + policy.responseTargetMinutes * 60_000);
  const resolutionDueAt = new Date(
    ticket.createdAt.getTime() + (policy.resolutionTargetMinutes + pausedMinutes) * 60_000
  );
  const firstResponseAt = getFirstResponseAt(ticket);

  const responseBreached = firstResponseAt ? firstResponseAt > responseDueAt : now > responseDueAt;
  const resolutionBreached = ticket.resolvedAt
    ? ticket.resolvedAt > resolutionDueAt
    : now > resolutionDueAt;

  return { responseDueAt, resolutionDueAt, firstResponseAt, responseBreached, resolutionBreached };
}
