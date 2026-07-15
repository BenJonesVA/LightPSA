"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Open to any staff role — dispatch/scheduling is a day-to-day coordination
// task, not an admin concern, same reasoning as Tickets/KB being open to
// all staff rather than gated like Boards/Clients creation.

export async function createVisit(formData: FormData) {
  await requireStaff();

  const ticketId = Number(formData.get("ticketId"));
  const technicianId = String(formData.get("technicianId") ?? "");
  const startTimeRaw = String(formData.get("startTime") ?? "");
  const endTimeRaw = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") ?? "").trim() || null;

  if (!Number.isInteger(ticketId) || !technicianId || !startTimeRaw || !endTimeRaw) {
    throw new Error("Ticket, technician, start time, and end time are required.");
  }

  const startTime = new Date(startTimeRaw);
  const endTime = new Date(endTimeRaw);
  if (!(endTime > startTime)) {
    throw new Error("End time must be after start time.");
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
