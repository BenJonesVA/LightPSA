"use server";

import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/components/ui/action-form";

function readFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim() || null;

  if (!title || !body) {
    return { error: "Title and body are required" } as const;
  }

  return { title, body, boardId } as const;
}

export async function createCannedResponse(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const user = await requirePermission(Permission.MANAGE_CANNED_RESPONSES, UserRole.ADMIN, UserRole.MANAGER);

  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error };
  const { title, body, boardId } = fields;

  await prisma.cannedResponse.create({
    data: { title, body, boardId, createdById: user.id },
  });

  revalidatePath("/admin/canned-responses");
  return null;
}

export async function updateCannedResponse(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_CANNED_RESPONSES, UserRole.ADMIN, UserRole.MANAGER);

  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error };
  const { title, body, boardId } = fields;

  await prisma.cannedResponse.update({
    where: { id },
    data: { title, body, boardId },
  });

  revalidatePath("/admin/canned-responses");
  return null;
}

export async function deleteCannedResponse(id: string) {
  await requirePermission(Permission.MANAGE_CANNED_RESPONSES, UserRole.ADMIN, UserRole.MANAGER);

  await prisma.cannedResponse.delete({ where: { id } });

  revalidatePath("/admin/canned-responses");
}
