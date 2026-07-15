import { prisma } from "@/lib/prisma";
import { runAutomationRules } from "@/lib/automation";
import { assertCronAuthorized, CronAuthError } from "@/lib/cron-auth";

// Drives the IDLE_TIME_EXCEEDED trigger. Nothing else in the app passes this
// trigger type into runAutomationRules — see lib/automation.ts for the
// idle-threshold matching and the post-fire debounce that keeps this from
// re-firing the same rule on every tick.
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

  const tickets = await prisma.ticket.findMany({
    where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
    select: {
      id: true,
      title: true,
      boardId: true,
      clientId: true,
      contactId: true,
      priority: true,
      status: true,
      assigneeId: true,
      updatedAt: true,
    },
  });

  for (const ticket of tickets) {
    await runAutomationRules(ticket, "IDLE_TIME_EXCEEDED", now);
  }

  return Response.json({ checked: tickets.length, ranAt: now.toISOString() });
}
