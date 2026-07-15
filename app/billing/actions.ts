"use server";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function approveTimeLog(id: string) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);
  await prisma.timeLog.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/billing");
}

export async function lockTimeLog(id: string) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);
  await prisma.timeLog.update({ where: { id }, data: { isLocked: true } });
  revalidatePath("/billing");
}

export async function approveExpense(id: string) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);
  await prisma.expense.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/billing");
}

export async function lockExpense(id: string) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);
  await prisma.expense.update({ where: { id }, data: { isLocked: true } });
  revalidatePath("/billing");
}
