import { redirect } from "next/navigation";
import type { Permission, UserRole } from "@prisma/client";
import { auth } from "@/auth";

// Server-only authorization helpers. Middleware only does a coarse
// authenticated/actor-type gate — every Server Component and Server Action
// that touches staff-only or role-gated data must call one of these itself.

export async function requireStaff() {
  const session = await auth();
  if (!session?.user || session.user.actorType !== "STAFF") {
    redirect("/login");
  }
  return session.user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireStaff();
  if (!user.role || !roles.includes(user.role)) {
    redirect("/unauthorized");
  }
  return user;
}

// Additive permission check: passes if the user's role is one of `roles`
// (identical to requireRole — this never restricts ADMIN/MANAGER below what
// they already have), OR the user holds `permission` via a PermissionGroup.
// Use this instead of requireRole wherever a permission group should be able
// to grant the capability to a role that wouldn't otherwise have it (e.g.
// letting a TECHNICIAN manage boards without promoting them to MANAGER).
export async function requirePermission(permission: Permission, ...roles: UserRole[]) {
  const user = await requireStaff();
  if (user.role && roles.includes(user.role)) return user;
  if (user.permissions?.includes(permission)) return user;
  redirect("/unauthorized");
}

export async function requireClientSession() {
  const session = await auth();
  if (!session?.user || session.user.actorType !== "CLIENT" || !session.user.clientId) {
    redirect("/login");
  }
  return session.user;
}
