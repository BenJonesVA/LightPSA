import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
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

export async function requireClientSession() {
  const session = await auth();
  if (!session?.user || session.user.actorType !== "CLIENT" || !session.user.clientId) {
    redirect("/login");
  }
  return session.user;
}
