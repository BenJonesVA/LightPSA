"use server";

import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function approveTimeLog(id: string) {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);
  await prisma.timeLog.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/billing");
}

export async function lockTimeLog(id: string) {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);
  await prisma.timeLog.update({ where: { id }, data: { isLocked: true } });
  revalidatePath("/billing");
}

export async function approveExpense(id: string) {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);
  await prisma.expense.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/billing");
}

export async function lockExpense(id: string) {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);
  await prisma.expense.update({ where: { id }, data: { isLocked: true } });
  revalidatePath("/billing");
}
