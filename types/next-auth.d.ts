import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";
import "next-auth";
import "next-auth/jwt";

type ActorType = "STAFF" | "CLIENT";

declare module "next-auth" {
  interface User {
    actorType: ActorType;
    role?: UserRole;
    clientId?: string;
  }

  interface Session {
    user: {
      id: string;
      actorType: ActorType;
      role?: UserRole;
      clientId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    actorType: ActorType;
    role?: UserRole;
    clientId?: string;
  }
}
