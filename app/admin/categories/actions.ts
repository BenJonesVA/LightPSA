"use server";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function createCategory(formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) {
    throw new Error("Category name is required");
  }

  await prisma.category.create({ data: { name, parentId } });

  revalidatePath("/admin/categories");
}

export async function renameCategory(id: string, formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) {
    throw new Error("Category name is required");
  }

  if (parentId) {
    if (parentId === id) {
      throw new Error("A category cannot be its own parent");
    }

    const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });
    const parentById = new Map(categories.map((c) => [c.id, c.parentId]));

    // Walk up the ancestor chain from the candidate parent — if `id` turns up,
    // reparenting here would create a cycle.
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === id) {
        throw new Error("Cannot move a category under one of its own descendants");
      }
      cursor = parentById.get(cursor) ?? null;
    }
  }

  await prisma.category.update({ where: { id }, data: { name, parentId } });

  revalidatePath("/admin/categories");
}

export async function deleteCategory(id: string) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
}
