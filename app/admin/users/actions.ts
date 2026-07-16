"use server";

import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import type { DeleteActionState } from "@/components/ui/delete-button";

const VALID_ROLES = Object.values(UserRole);

export async function createUser(formData: FormData) {
  await requireRole(UserRole.ADMIN);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    throw new Error("Name, email, and password are required");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (!VALID_ROLES.includes(role as UserRole)) {
    throw new Error("Invalid role");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await prisma.user.create({
      data: { name, email, title, role: role as UserRole, passwordHash },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("A user with that email already exists");
    }
    throw error;
  }

  redirect(`/admin/users/${user.id}`);
}

export async function updateUser(id: string, formData: FormData) {
  await requireRole(UserRole.ADMIN);

  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");
  const isActive = formData.get("isActive") === "on";
  const newPassword = String(formData.get("password") ?? "");

  if (!name) {
    throw new Error("Name is required");
  }
  if (!VALID_ROLES.includes(role as UserRole)) {
    throw new Error("Invalid role");
  }
  if (newPassword && newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const currentUser = await prisma.user.findUnique({ where: { id } });
  if (!currentUser) {
    throw new Error("User not found");
  }

  // If this edit would take the user out of "active ADMIN" status (role
  // changed away from ADMIN, or deactivated) and they currently ARE an
  // active admin, make sure at least one other active admin remains —
  // otherwise the account could lock every admin out of staff management.
  const wasActiveAdmin = currentUser.role === UserRole.ADMIN && currentUser.isActive;
  const staysActiveAdmin = role === UserRole.ADMIN && isActive;
  if (wasActiveAdmin && !staysActiveAdmin) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: UserRole.ADMIN, isActive: true, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      throw new Error("Cannot remove the last active admin");
    }
  }

  const data: Prisma.UserUpdateInput = {
    name,
    title,
    role: role as UserRole,
    isActive,
  };

  if (newPassword) {
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await prisma.user.update({ where: { id }, data });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
}

// Returns { error } instead of throwing for expected/guarded failures — a
// thrown Error's message gets redacted by Next.js in production builds
// (components/ui/delete-button.tsx explains why), which would otherwise turn
// these into a blank crash screen instead of a useful message.
export async function deleteUser(id: string, _prevState: DeleteActionState, _formData: FormData): Promise<DeleteActionState> {
  await requireRole(UserRole.ADMIN);

  const currentUser = await prisma.user.findUnique({ where: { id } });
  if (!currentUser) {
    return { error: "User not found" };
  }

  if (currentUser.role === UserRole.ADMIN && currentUser.isActive) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: UserRole.ADMIN, isActive: true, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      return { error: "Cannot remove the last active admin" };
    }
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    // Required (non-nullable) FKs like TimeLog.userId, Expense.userId,
    // KbArticle.createdById, and CannedResponse.createdById have no
    // onDelete behavior, so Prisma throws P2003 if any exist for this user.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        error: "Cannot delete a user with existing time logs, expenses, or authored content — deactivate the account instead.",
      };
    }
    throw error;
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
