import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";

// Refetched on every request alongside the isActive re-check below, not
// cached in the token beyond that — an admin revoking a group should take
// effect on the user's very next page load, not just their next login.
async function loadPermissions(userId: string) {
  const memberships = await prisma.userPermissionGroup.findMany({
    where: { userId },
    select: { group: { select: { permissions: true } } },
  });
  return Array.from(new Set(memberships.flatMap((m) => m.group.permissions)));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // authConfig's jwt() (Edge-safe, no Prisma) only runs the branch that
    // stamps claims onto a *fresh* token at sign-in. This Node-only override
    // adds the other half: on every subsequent request, confirm the
    // underlying User/Contact row still exists and is still allowed to log
    // in. Without this, a token signed before a DB reset/reseed (this
    // project's dev DB has already been reset at least once) — or a
    // since-deactivated account — keeps looking "valid" (the signature still
    // checks out) right up until the first write that trusts
    // session.user.id as a foreign key, which then 500s with a raw Prisma
    // constraint violation instead of bouncing the user back to /login.
    // Returning null here ends the session cleanly.
    async jwt({ token, user }) {
      if (user) {
        token.actorType = user.actorType;
        token.role = user.role;
        token.clientId = user.clientId;
        token.permissions = user.actorType === "STAFF" ? await loadPermissions(user.id!) : [];
        return token;
      }

      if (token.actorType === "STAFF") {
        const stillValid = await prisma.user.findUnique({
          where: { id: token.sub! },
          select: { isActive: true },
        });
        if (!stillValid?.isActive) return null;
        token.permissions = await loadPermissions(token.sub!);
      } else if (token.actorType === "CLIENT") {
        const stillValid = await prisma.contact.findUnique({
          where: { id: token.sub! },
          select: { isActive: true, portalAccess: true },
        });
        if (!stillValid?.isActive || !stillValid.portalAccess) return null;
      }

      return token;
    },
  },
  providers: [
    Credentials({
      id: "staff-login",
      name: "Staff",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          actorType: "STAFF",
          role: user.role,
        };
      },
    }),
    Credentials({
      id: "client-login",
      name: "Client Portal",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const contact = await prisma.contact.findUnique({ where: { email } });
        if (!contact || !contact.isActive || !contact.portalAccess || !contact.passwordHash) {
          return null;
        }

        const valid = await bcrypt.compare(password, contact.passwordHash);
        if (!valid) return null;

        return {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`,
          email: contact.email,
          actorType: "CLIENT",
          clientId: contact.clientId,
        };
      },
    }),
  ],
});
