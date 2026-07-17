"use server";

import { Permission, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/components/ui/action-form";
import { ASSET_FIELD_TYPES, isValidFieldKey } from "@/lib/asset-fields";

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

export async function updateCategoryFieldSchema(id: string, formData: FormData) {
  await requirePermission(Permission.MANAGE_CATEGORIES, UserRole.ADMIN, UserRole.MANAGER);

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("fieldSchema") ?? "[]"));
  } catch {
    throw new Error("Malformed field schema submission");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Malformed field schema submission");
  }

  const seenKeys = new Set<string>();
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error("Every field needs a key, label, and type");
    }
    const { key, label, type, options } = entry as Record<string, unknown>;

    if (typeof key !== "string" || !isValidFieldKey(key)) {
      throw new Error(`"${key}" is not a valid field key — use lowercase letters, numbers, and underscores, starting with a letter`);
    }
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate field key "${key}"`);
    }
    seenKeys.add(key);

    if (typeof label !== "string" || !label.trim()) {
      throw new Error(`Field "${key}" needs a label`);
    }
    if (!ASSET_FIELD_TYPES.includes(type as (typeof ASSET_FIELD_TYPES)[number])) {
      throw new Error(`Field "${key}" has an invalid type`);
    }
    if (type === "select") {
      if (!Array.isArray(options) || options.filter((o) => typeof o === "string" && o.trim()).length === 0) {
        throw new Error(`Select field "${key}" needs at least one option`);
      }
    }
  }

  await prisma.category.update({
    where: { id },
    data: { fieldSchema: parsed as Prisma.InputJsonValue },
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}/fields`);
  revalidatePath("/tickets/new");
}

export async function deleteCategory(id: string) {
  await requirePermission(Permission.MANAGE_CATEGORIES, UserRole.ADMIN, UserRole.MANAGER);

  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
}
