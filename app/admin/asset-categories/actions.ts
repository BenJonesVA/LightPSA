"use server";

import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { DeleteActionState } from "@/components/ui/delete-button";

export async function createAssetCategory(formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) {
    throw new Error("Category name is required");
  }

  await prisma.assetCategory.create({ data: { name, parentId } });

  revalidatePath("/admin/asset-categories");
}

export async function renameAssetCategory(id: string, formData: FormData) {
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

    const categories = await prisma.assetCategory.findMany({ select: { id: true, parentId: true } });
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

  await prisma.assetCategory.update({ where: { id }, data: { name, parentId } });

  revalidatePath("/admin/asset-categories");
}

// Returns { error } instead of throwing for the expected/guarded failure —
// a thrown Error's message gets redacted by Next.js in production builds
// (components/ui/delete-button.tsx explains why). Asset.categoryId is a
// required FK with no onDelete set (RESTRICT), so a category with assets
// still assigned to it can't be hard-deleted.
export async function deleteAssetCategory(
  id: string,
  _prevState: DeleteActionState,
  _formData: FormData
): Promise<DeleteActionState> {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  try {
    await prisma.assetCategory.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "Cannot delete a category with assets assigned to it — reassign those assets first." };
    }
    throw error;
  }

  revalidatePath("/admin/asset-categories");
  return null;
}
