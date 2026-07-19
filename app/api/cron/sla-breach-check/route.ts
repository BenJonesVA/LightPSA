import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSlaStatus } from "@/lib/sla";
import { sendEmail } from "@/lib/email";
import { assertCronAuthorized, CronAuthError } from "@/lib/cron-auth";

// Proactive SLA breach alerting. getSlaStatus (lib/sla.ts) already computes
// breach state at read time for the ticket-detail page; this sweep is the
// only thing that turns "breached" into a pushed notification instead of
// something a staff member has to notice by opening the ticket.
//
// The internal comment is always written and is the system-of-record for
// dedup (see the marker strings below) — email delivery is best-effort on
// top of it, not a replacement for it. If no email provider is configured
// (see lib/email.ts), the comment is the only thing that happens, same as
// before; that's a real, honest outcome, not a broken one.
// Alerts are deduped per breach kind via a marker string in the comment body:
// without that, every run would re-alert on every still-open breached ticket.
const RESPONSE_MARKER = "[SLA Breach: response]";
const RESOLUTION_MARKER = "[SLA Breach: resolution]";

export async function GET(request: Request) {
  try {
    assertCronAuthorized(request);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const now = new Date();

  const [policies, tickets, staff] = await Promise.all([
    prisma.slaPolicy.findMany({ where: { isActive: true } }),
    prisma.ticket.findMany({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        waitingSince: true,
        totalWaitMinutes: true,
        priority: true,
        comments: { select: { createdAt: true, authorUserId: true, isInternal: true, body: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.MANAGER] }, isActive: true },
      select: { id: true, email: true },
    }),
  ]);

  const policyByPriority = new Map(policies.map((p) => [p.priority, p]));
  const staffEmails = staff.map((s) => s.email);

  let alertsSent = 0;

  async function alert(ticketId: number, marker: string, message: string, subject: string) {
    await prisma.ticketComment.create({
      data: { ticketId, isInternal: true, body: `${marker} ${message}` },
    });
    if (staffEmails.length > 0) {
      await sendEmail({ to: staffEmails, subject, html: `<p>${message}</p>` });
    }
    if (staff.length > 0) {
      await prisma.notification.createMany({
        data: staff.map((s) => ({
          userId: s.id,
          ticketId,
          type: "SLA_BREACH" as const,
          message,
        })),
      });
    }
    alertsSent++;
  }

  for (const ticket of tickets) {
    const policy = policyByPriority.get(ticket.priority);
    if (!policy) continue;

    const status = getSlaStatus(ticket, policy, now);
    const alreadyAlertedResponse = ticket.comments.some((c) => c.body.startsWith(RESPONSE_MARKER));
    const alreadyAlertedResolution = ticket.comments.some((c) => c.body.startsWith(RESOLUTION_MARKER));

    if (status.responseBreached && !alreadyAlertedResponse) {
      await alert(
        ticket.id,
        RESPONSE_MARKER,
        `Response target (${policy.responseTargetMinutes}m) was missed on TKT-${ticket.id} (${ticket.title}) — no client-visible reply was posted in time.`,
        `SLA response breach: TKT-${ticket.id}`
      );
    }

    if (status.resolutionBreached && !alreadyAlertedResolution) {
      await alert(
        ticket.id,
        RESOLUTION_MARKER,
        `Resolution target (${policy.resolutionTargetMinutes}m) was missed on TKT-${ticket.id} (${ticket.title}) — ticket is still open past its due date.`,
        `SLA resolution breach: TKT-${ticket.id}`
      );
    }
  }

  return Response.json({ checked: tickets.length, alertsSent, ranAt: now.toISOString() });
}
