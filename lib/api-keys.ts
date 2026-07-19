import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { ApiKey } from "@prisma/client";

// SHA-256, not bcrypt: this authenticates a machine credential (a monitoring
// tool's static API key) by exact-match lookup against ApiKey.keyHash, not a
// login password verified against one already-known hash. bcrypt salts each
// hash independently, so the same input never hashes the same way twice —
// that's exactly what makes it safe for password *verification* but unusable
// for a `findUnique({ where: { keyHash } })` lookup, which needs a
// deterministic digest. SHA-256 is fast and deterministic, which is what a
// lookup-by-hash query requires; a high-entropy generated key (not a
// human-chosen password) makes brute-forcing the fast hash impractical.
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Looks up an active ApiKey by its raw (unhashed) presented value and, on
// success, records the usage. Returns null on any failure (unknown hash or
// isActive: false) so callers can respond with a uniform 401 without leaking
// which case applied.
export async function verifyApiKey(rawKey: string): Promise<ApiKey | null> {
  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || !apiKey.isActive) {
    return null;
  }
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });
  return apiKey;
}
