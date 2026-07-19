"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/components/ui/action-form";

const CONFLICT_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

// Open to any staff role — dispatch/scheduling is a day-to-day coordination
// task, not an admin concern, same reasoning as Tickets/KB being open to
// all staff rather than gated like Boards/Clients creation.

export async function createVisit(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireStaff();

  const ticketId = Number(formData.get("ticketId"));
  const technicianId = String(formData.get("technicianId") ?? "");
  const startTimeRaw = String(formData.get("startTime") ?? "");
  const endTimeRaw = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!Number.isInteger(ticketId) || !technicianId || !startTimeRaw || !endTimeRaw) {
    return { error: "Ticket, technician, start time, and end time are required." };
  }

  const startTime = new Date(startTimeRaw);
  const endTime = new Date(endTimeRaw);
  if (!(endTime > startTime)) {
    return { error: "End time must be after start time." };
  }

  const force = formData.get("force") === "on";

  if (!force) {
    const conflicts = await prisma.scheduledVisit.findMany({
      where: { technicianId, startTime: { lt: endTime }, endTime: { gt: startTime } },
      include: { ticket: { select: { id: true, title: true } } },
    });

    if (conflicts.length > 0) {
      const summary = conflicts
        .map(
          (c) =>
            `${c.startTime.toLocaleString("en-US", CONFLICT_TIME_FORMAT)} – ${c.endTime.toLocaleString(
              "en-US",
              CONFLICT_TIME_FORMAT,
            )} (TKT-${c.ticket.id} · ${c.ticket.title})`,
        )
        .join("; ");
      return {
        error: `This technician already has a conflicting visit: ${summary}. Check "Create anyway" below and resubmit to double-book.`,
      };
    }
  }

  await prisma.scheduledVisit.create({
    data: { ticketId, technicianId, startTime, endTime, location },
  });

  redirect("/schedule");
}

export async function cancelVisit(visitId: string, ticketId: number) {
  await requireStaff();

  await prisma.scheduledVisit.delete({ where: { id: visitId } });

  revalidatePath("/schedule");
  revalidatePath(`/tickets/${ticketId}`);
}
