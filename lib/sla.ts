import type { SlaPolicy, TicketComment } from "@prisma/client";

export type SlaStatus = {
  responseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseAt: Date | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
};

type TicketForSla = {
  createdAt: Date;
  resolvedAt: Date | null;
  comments: Pick<TicketComment, "createdAt" | "authorUserId" | "isInternal">[];
};

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
  const responseDueAt = new Date(ticket.createdAt.getTime() + policy.responseTargetMinutes * 60_000);
  const resolutionDueAt = new Date(ticket.createdAt.getTime() + policy.resolutionTargetMinutes * 60_000);
  const firstResponseAt = getFirstResponseAt(ticket);

  const responseBreached = firstResponseAt ? firstResponseAt > responseDueAt : now > responseDueAt;
  const resolutionBreached = ticket.resolvedAt
    ? ticket.resolvedAt > resolutionDueAt
    : now > resolutionDueAt;

  return { responseDueAt, resolutionDueAt, firstResponseAt, responseBreached, resolutionBreached };
}
