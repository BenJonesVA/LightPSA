"use server";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

function readFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim() || null;

  if (!title || !body) {
    throw new Error("Title and body are required");
  }

  return { title, body, boardId };
}

export async function createCannedResponse(formData: FormData) {
  const user = await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const { title, body, boardId } = readFields(formData);

  await prisma.cannedResponse.create({
    data: { title, body, boardId, createdById: user.id },
  });

  revalidatePath("/admin/canned-responses");
}

export async function updateCannedResponse(id: string, formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const { title, body, boardId } = readFields(formData);

  await prisma.cannedResponse.update({
    where: { id },
    data: { title, body, boardId },
  });

  revalidatePath("/admin/canned-responses");
}

export async function deleteCannedResponse(id: string) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  await prisma.cannedResponse.delete({ where: { id } });

  revalidatePath("/admin/canned-responses");
}
