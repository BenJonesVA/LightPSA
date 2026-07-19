import type { SlaPolicy, TicketComment, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export type ResolvedSlaPolicy = Pick<SlaPolicy, "responseTargetMinutes" | "resolutionTargetMinutes"> & {
  isActive: boolean;
};

function toResolvedPolicy(policy: Pick<SlaPolicy, "responseTargetMinutes" | "resolutionTargetMinutes">): ResolvedSlaPolicy {
  return {
    responseTargetMinutes: policy.responseTargetMinutes,
    resolutionTargetMinutes: policy.resolutionTargetMinutes,
    isActive: true,
  };
}

/**
 * Resolves the effective SLA targets for a single ticket's client + priority:
 * an active per-client override (ClientSlaPolicy) takes precedence over the
 * active global per-priority policy (SlaPolicy). Returns null if neither an
 * active override nor an active global policy exists — callers treat that
 * identically to today's "no SLA policy configured" (no SLA card/status shown).
 *
 * For list/report pages resolving many tickets at once, use
 * `loadSlaPolicyResolver` instead to avoid one query pair per ticket.
 */
export async function resolveSlaPolicy(
  clientId: string,
  priority: TicketPriority
): Promise<ResolvedSlaPolicy | null> {
  const override = await prisma.clientSlaPolicy.findUnique({
    where: { clientId_priority: { clientId, priority } },
  });
  if (override && override.isActive) return toResolvedPolicy(override);

  const globalPolicy = await prisma.slaPolicy.findUnique({ where: { priority } });
  if (globalPolicy && globalPolicy.isActive) return toResolvedPolicy(globalPolicy);

  return null;
}

/**
 * Batched variant of `resolveSlaPolicy` for pages that resolve SLA status for
 * many tickets across many clients: fetches every active ClientSlaPolicy row
 * for the given clients plus every active global SlaPolicy row up front, then
 * returns a synchronous lookup function — one query pair total instead of a
 * per-ticket round trip.
 */
export async function loadSlaPolicyResolver(
  clientIds: string[]
): Promise<(clientId: string, priority: TicketPriority) => ResolvedSlaPolicy | null> {
  const uniqueClientIds = Array.from(new Set(clientIds));

  const [overrides, globalPolicies] = await Promise.all([
    uniqueClientIds.length > 0
      ? prisma.clientSlaPolicy.findMany({ where: { clientId: { in: uniqueClientIds }, isActive: true } })
      : Promise.resolve([]),
    prisma.slaPolicy.findMany({ where: { isActive: true } }),
  ]);

  const overrideByKey = new Map(overrides.map((o) => [`${o.clientId}:${o.priority}`, o]));
  const globalByPriority = new Map(globalPolicies.map((p) => [p.priority, p]));

  return (clientId: string, priority: TicketPriority): ResolvedSlaPolicy | null => {
    const override = overrideByKey.get(`${clientId}:${priority}`);
    if (override) return toResolvedPolicy(override);

    const globalPolicy = globalByPriority.get(priority);
    if (globalPolicy) return toResolvedPolicy(globalPolicy);

    return null;
  };
}
