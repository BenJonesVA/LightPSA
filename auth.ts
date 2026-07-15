import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
