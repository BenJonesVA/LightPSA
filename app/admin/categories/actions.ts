"use server";

import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/components/ui/action-form";

export async function createCategory(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_CATEGORIES, UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) {
    return { error: "Category name is required" };
  }

  await prisma.category.create({ data: { name, parentId } });

  revalidatePath("/admin/categories");
  return null;
}

export async function renameCategory(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_CATEGORIES, UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) {
    return { error: "Category name is required" };
  }

  if (parentId) {
    if (parentId === id) {
      return { error: "A category cannot be its own parent" };
    }

    const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });
    const parentById = new Map(categories.map((c) => [c.id, c.parentId]));

    // Walk up the ancestor chain from the candidate parent — if `id` turns up,
    // reparenting here would create a cycle.
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === id) {
        return { error: "Cannot move a category under one of its own descendants" };
      }
      cursor = parentById.get(cursor) ?? null;
    }
  }

  await prisma.category.update({ where: { id }, data: { name, parentId } });

  revalidatePath("/admin/categories");
  return null;
}

export async function deleteCategory(id: string) {
  await requirePermission(Permission.MANAGE_CATEGORIES, UserRole.ADMIN, UserRole.MANAGER);

  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
}
