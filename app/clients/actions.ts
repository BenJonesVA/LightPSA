"use server";

import { Permission, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { getOrgLabels } from "@/lib/settings";
import { parseFieldSchema, extractCustomFieldsFromFormData, validateCustomFieldValues } from "@/lib/asset-fields";
import type { DeleteActionState } from "@/components/ui/delete-button";
import type { FormActionState } from "@/components/ui/action-form";

export async function createClient(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_CLIENTS, UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) {
    const labels = await getOrgLabels();
    return { error: `${labels.client} name is required` };
  }

  const client = await prisma.client.create({
    data: { name, billingAddress, parentId },
  });

  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_CLIENTS, UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;
  const isActive = formData.get("isActive") === "on";

  if (!name) {
    const labels = await getOrgLabels();
    return { error: `${labels.client} name is required` };
  }

  await prisma.client.update({
    where: { id },
    data: { name, billingAddress, isActive },
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return null;
}

// Returns { error } instead of throwing for the expected/guarded failure —
// a thrown Error's message gets redacted by Next.js in production builds
// (components/ui/delete-button.tsx explains why), which would otherwise turn
// this into a blank crash screen instead of the message below.
export async function deleteClient(id: string, _prevState: DeleteActionState, _formData: FormData): Promise<DeleteActionState> {
  await requirePermission(Permission.MANAGE_CLIENTS, UserRole.ADMIN, UserRole.MANAGER);

  try {
    await prisma.client.delete({ where: { id } });
  } catch (error) {
    // Ticket.clientId and Contract.clientId are required FKs with no
    // onDelete set (RESTRICT), so either one existing blocks the delete.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      const labels = await getOrgLabels();
      return {
        error: `Cannot delete a ${labels.client.toLowerCase()} with existing tickets or contracts — deactivate it instead.`,
      };
    }
    throw error;
  }

  revalidatePath("/clients");
  redirect("/clients");
}

export async function createContact(clientId: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_CLIENTS, UserRole.ADMIN, UserRole.MANAGER);

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const isPrimary = formData.get("isPrimary") === "on";
  const isBilling = formData.get("isBilling") === "on";
  const portalAccess = formData.get("portalAccess") === "on";

  if (!firstName || !lastName || !email) {
    return { error: "First name, last name, and email are required" };
  }

  await prisma.contact.create({
    data: {
      clientId,
      firstName,
      lastName,
      email,
      phone,
      title,
      isPrimary,
      isBilling,
      portalAccess,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return null;
}

export async function createAsset(clientId: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_ASSETS, UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const serialNumber = String(formData.get("serialNumber") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !categoryId) {
    return { error: "Asset name and category are required" };
  }

  const category = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new Error("Selected category no longer exists");
  }
  const fieldSchema = parseFieldSchema(category.fieldSchema);
  const customFields = extractCustomFieldsFromFormData(formData, fieldSchema);
  const fieldError = validateCustomFieldValues(fieldSchema, customFields);
  if (fieldError) {
    return { error: fieldError };
  }

  await prisma.asset.create({
    data: { clientId, name, categoryId, serialNumber, notes, customFields },
  });

  revalidatePath(`/clients/${clientId}`);
  return null;
}
