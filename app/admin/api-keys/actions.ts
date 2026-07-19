"use server";

import { randomBytes } from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { hashApiKey } from "@/lib/api-keys";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DeleteActionState } from "@/components/ui/delete-button";
import type { FormActionState } from "@/components/ui/action-form";

// ADMIN-only, deliberately not gated by any Permission — same reasoning as
// Permission Groups: this mints a machine credential capable of filing
// tickets via the API, so letting a granted permission unlock it would let a
// permissioned user hand themselves more access than an ADMIN gave them.
export async function createApiKey(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requireRole(UserRole.ADMIN);

  const label = String(formData.get("label") ?? "").trim();
  if (!label) {
    return { error: "Label is required" };
  }

  const rawKey = randomBytes(32).toString("hex");
  await prisma.apiKey.create({
    data: { label, keyHash: hashApiKey(rawKey) },
  });

  revalidatePath("/admin/api-keys");
  // The raw key only ever exists here, in memory, right after creation —
  // only its hash is persisted. A query param on the redirect to the same
  // page is the simplest way to surface it once, same request, no session
  // or cookie plumbing needed for an ADMIN-only one-time reveal.
  redirect(`/admin/api-keys?newKey=${rawKey}`);
}

export async function toggleApiKeyActive(id: string, _prevState: FormActionState, _formData: FormData): Promise<FormActionState> {
  await requireRole(UserRole.ADMIN);

  const apiKey = await prisma.apiKey.findUnique({ where: { id } });
  if (!apiKey) {
    return { error: "API key not found" };
  }

  await prisma.apiKey.update({
    where: { id },
    data: { isActive: !apiKey.isActive },
  });

  revalidatePath("/admin/api-keys");
  return null;
}

export async function deleteApiKey(id: string, _prevState: DeleteActionState, _formData: FormData): Promise<DeleteActionState> {
  await requireRole(UserRole.ADMIN);

  await prisma.apiKey.delete({ where: { id } });

  revalidatePath("/admin/api-keys");
  redirect("/admin/api-keys");
}
