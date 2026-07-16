"use server";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DeleteActionState } from "@/components/ui/delete-button";
import { parseFieldSchema, extractCustomFieldsFromFormData, validateCustomFieldValues } from "@/lib/asset-fields";

export async function updateAsset(id: string, formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";

  if (!name || !clientId || !categoryId) {
    throw new Error("Asset name, client, and category are required");
  }

  const existing = await prisma.asset.findUnique({ where: { id }, select: { clientId: true } });
  if (!existing) {
    throw new Error("Asset not found");
  }

  const category = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new Error("Selected category no longer exists");
  }
  const fieldSchema = parseFieldSchema(category.fieldSchema);
  const customFields = extractCustomFieldsFromFormData(formData, fieldSchema);
  const fieldError = validateCustomFieldValues(fieldSchema, customFields);
  if (fieldError) {
    throw new Error(fieldError);
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: { name, clientId, categoryId, serialNumber, notes, isActive, customFields },
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath(`/clients/${existing.clientId}`);
  if (asset.clientId !== existing.clientId) {
    revalidatePath(`/clients/${asset.clientId}`);
  }
}

// TicketAsset.assetId cascades on delete (unlike Board/User/Client, which
// RESTRICT), so deleting an asset can't fail on existing ticket links — it
// just unlinks them. No guard needed, but still returns { error } instead of
// throwing on the unexpected-failure path for the same reason as the other
// delete actions (see components/ui/delete-button.tsx): a thrown Error's
// message gets redacted by Next.js in production builds.
export async function deleteAsset(id: string, _prevState: DeleteActionState, _formData: FormData): Promise<DeleteActionState> {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const asset = await prisma.asset.findUnique({ where: { id }, select: { clientId: true } });
  if (!asset) {
    return { error: "Asset not found." };
  }

  await prisma.asset.delete({ where: { id } });

  revalidatePath("/assets");
  revalidatePath(`/clients/${asset.clientId}`);
  redirect("/assets");
}
