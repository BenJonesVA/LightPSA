import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import type { AutomationTrigger, Ticket } from "@prisma/client";

type TicketForAutomation = Pick<
  Ticket,
  "id" | "title" | "boardId" | "clientId" | "contactId" | "priority" | "status" | "assigneeId" | "updatedAt"
>;

/**
 * Applies matching automation rules for a trigger event, in a single pass,
 * directly via prisma.ticket.update — never by calling back through the
 * ticket Server Actions, and never by re-invoking this function. That's what
 * prevents a rule whose action re-fires the same trigger type it reacts to
 * (e.g. a CHANGE_STATUS action wired into the STATUS_CHANGED trigger) from
 * cascading or looping. Callers must NOT wrap this call in anything that
 * re-triggers automation for the same ticket.
 *
 * IDLE_TIME_EXCEEDED is the one trigger type this function does NOT expect to
 * be called synchronously from a ticket action — it's driven by the cron
 * sweep at app/api/cron/idle-sweep/route.ts, which is the only caller that
 * passes it. `now` is injectable so that sweep can evaluate every ticket in a
 * batch against a single consistent instant.
 */
export async function runAutomationRules(
  ticket: TicketForAutomation,
  triggerType: AutomationTrigger,
  now: Date = new Date()
): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { triggerType, isActive: true },
  });

  const matching = rules.filter((rule) => {
    if (rule.conditionBoardId !== null && rule.conditionBoardId !== ticket.boardId) return false;
    if (rule.conditionPriority !== null && rule.conditionPriority !== ticket.priority) return false;
    if (rule.conditionClientId !== null && rule.conditionClientId !== ticket.clientId) return false;
    if (triggerType === "IDLE_TIME_EXCEEDED") {
      if (rule.conditionIdleMinutes === null) return false;
      const idleMinutes = (now.getTime() - ticket.updatedAt.getTime()) / 60_000;
      if (idleMinutes < rule.conditionIdleMinutes) return false;
    }
    return true;
  });

  for (const rule of matching) {
    switch (rule.actionType) {
      case "ASSIGN_TECHNICIAN":
        if (rule.actionAssigneeId) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { assigneeId: rule.actionAssigneeId },
          });
        }
        break;

      case "CHANGE_STATUS":
        if (rule.actionStatus) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: rule.actionStatus },
          });
        }
        break;

      case "CHANGE_PRIORITY":
        if (rule.actionPriority) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { priority: rule.actionPriority },
          });
        }
        break;

      case "SEND_EMAIL_NOTIFICATION": {
        // This notifies the ticket's *client contact* — the natural reading
        // of "send email notification" on a customer ticket. It is never
        // reported as sent unless sendEmail() actually confirms it; on any
        // failure (no contact, no provider configured, API error) this
        // writes a clearly-labeled internal note instead of fabricating a
        // claim that a real notification went out.
        const contact = ticket.contactId
          ? await prisma.contact.findUnique({ where: { id: ticket.contactId }, select: { email: true } })
          : null;

        if (!contact?.email) {
          await prisma.ticketComment.create({
            data: {
              ticketId: ticket.id,
              isInternal: true,
              body: `[Automation] Rule "${rule.name}" would send an email notification, but ticket TKT-${ticket.id} has no client contact on file to notify.`,
            },
          });
          break;
        }

        const result = await sendEmail({
          to: contact.email,
          subject: `Update on your ticket TKT-${ticket.id}: ${ticket.title}`,
          html: `<p>There's an update on your ticket <strong>TKT-${ticket.id}: ${ticket.title}</strong>.</p><p>Current status: ${ticket.status}.</p>`,
        });

        await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            isInternal: true,
            body: result.sent
              ? `[Automation] Rule "${rule.name}" sent an email notification to ${contact.email}.`
              : `[Automation] Rule "${rule.name}" tried to send an email notification to ${contact.email} but it did not go out: ${result.reason}.`,
          },
        });
        break;
      }
    }
  }

  // An idle rule that fired has, by definition, just acted on the ticket —
  // it's no longer idle. SEND_EMAIL_NOTIFICATION doesn't touch the Ticket row
  // itself (only writes a comment), so without this explicit touch the same
  // rule would re-match and re-fire on every subsequent cron tick forever.
  // ASSIGN_TECHNICIAN/CHANGE_STATUS/CHANGE_PRIORITY already bump updatedAt as
  // a side effect of their own update, but touching it here unconditionally
  // keeps the debounce guarantee independent of which action ran.
  if (triggerType === "IDLE_TIME_EXCEEDED" && matching.length > 0) {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: now } });
  }
}

const PRIORITY_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, EMERGENCY: 3 };

/** A priority change only counts as an "escalation" if it strictly increases. */
export function isPriorityEscalation(oldPriority: string, newPriority: string): boolean {
  return PRIORITY_RANK[newPriority] > PRIORITY_RANK[oldPriority];
}
