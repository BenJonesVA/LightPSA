"use server";

import { Permission, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { DeleteActionState } from "@/components/ui/delete-button";
import type { FormActionState } from "@/components/ui/action-form";

const VALID_PERMISSIONS = new Set(Object.values(Permission));

// Kept ADMIN-only, deliberately not gated by any Permission itself — this is
// the one screen that grants permissions, so letting a granted permission
// unlock it would let a MANAGER (or a permissioned TECHNICIAN) hand
// themselves more access than an ADMIN gave them.
function readPermissions(formData: FormData): Permission[] {
  return formData
    .getAll("permissions")
    .map(String)
    .filter((p): p is Permission => VALID_PERMISSIONS.has(p as Permission));
}

export async function createPermissionGroup(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireRole(UserRole.ADMIN);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Group name is required" };
  }

  const permissions = readPermissions(formData);

  try {
    await prisma.permissionGroup.create({ data: { name, permissions } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A group with that name already exists" };
    }
    throw error;
  }

  revalidatePath("/admin/permission-groups");
  return null;
}

export async function updatePermissionGroup(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireRole(UserRole.ADMIN);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Group name is required" };
  }

  const permissions = readPermissions(formData);

  try {
    await prisma.permissionGroup.update({ where: { id }, data: { name, permissions } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A group with that name already exists" };
    }
    throw error;
  }

  revalidatePath("/admin/permission-groups");
  return null;
}

// No FK-restrict guard needed — UserPermissionGroup cascades on delete, so
// removing a group just removes it from any members' grants, same as
// deactivating a role never fails on existing references.
export async function deletePermissionGroup(id: string, _prevState: DeleteActionState, _formData: FormData): Promise<DeleteActionState> {
  await requireRole(UserRole.ADMIN);

  await prisma.permissionGroup.delete({ where: { id } });

  revalidatePath("/admin/permission-groups");
  return null;
}
