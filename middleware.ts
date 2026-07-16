import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "./auth.config";

// Edge runtime: instantiated from the Edge-safe config only (no bcrypt/Prisma).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const actorType = req.auth?.user?.actorType;
  const isPortalPath = nextUrl.pathname.startsWith("/portal");

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPortalPath && actorType !== "CLIENT") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (!isPortalPath && actorType !== "STAFF") {
    return NextResponse.redirect(new URL("/portal", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Everything except the NextAuth API routes, the login page, static assets,
  // the cron API routes, the inbound-email webhook, and the CSAT survey
  // routes. Cron routes are called by a scheduler with no browser session —
  // they authenticate via their own CRON_SECRET bearer check
  // (lib/cron-auth.ts) instead. The inbound-email webhook is called by
  // Postmark, also with no session — it authenticates via a secret token
  // query param (see app/api/inbound-email/route.ts). CSAT survey links go
  // to a client contact who isn't logged in at all — the unguessable
  // CsatResponse id in the URL *is* the authorization for that route, same
  // role the bearer/token checks play for cron and inbound email.
  matcher: [
    "/((?!api/auth|api/cron|api/inbound-email|csat|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
