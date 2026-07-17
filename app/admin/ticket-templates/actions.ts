"use server";

import { Permission, UserRole, type TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/components/ui/action-form";

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];

function readFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const titleTemplate = String(formData.get("titleTemplate") ?? "").trim();
  const descriptionTemplate = String(formData.get("descriptionTemplate") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim() || null;
  const categoryId = String(formData.get("categoryId") ?? "").trim() || null;
  const priorityRaw = String(formData.get("priority") ?? "MEDIUM");
  const priority = PRIORITIES.includes(priorityRaw as TicketPriority) ? (priorityRaw as TicketPriority) : "MEDIUM";

  if (!name || !titleTemplate) {
    return { error: "Name and title template are required" } as const;
  }

  return { name, titleTemplate, descriptionTemplate, boardId, categoryId, priority } as const;
}

export async function createTicketTemplate(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const user = await requirePermission(Permission.MANAGE_TICKET_TEMPLATES, UserRole.ADMIN, UserRole.MANAGER);

  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error };

  await prisma.ticketTemplate.create({ data: { ...fields, createdById: user.id } });

  revalidatePath("/admin/ticket-templates");
  return null;
}

export async function updateTicketTemplate(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_TICKET_TEMPLATES, UserRole.ADMIN, UserRole.MANAGER);

  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error };

  await prisma.ticketTemplate.update({ where: { id }, data: fields });

  revalidatePath("/admin/ticket-templates");
  return null;
}

export async function deleteTicketTemplate(id: string) {
  await requirePermission(Permission.MANAGE_TICKET_TEMPLATES, UserRole.ADMIN, UserRole.MANAGER);

  await prisma.ticketTemplate.delete({ where: { id } });

  revalidatePath("/admin/ticket-templates");
}
