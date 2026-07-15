import type { NextAuthConfig } from "next-auth";

// Edge-safe config only: no bcrypt, no Prisma. This is imported by both
// `middleware.ts` (Edge runtime) and `auth.ts` (Node runtime, adds providers).
export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.actorType = user.actorType;
        token.role = user.role;
        token.clientId = user.clientId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.actorType = token.actorType;
      session.user.role = token.role;
      session.user.clientId = token.clientId;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
