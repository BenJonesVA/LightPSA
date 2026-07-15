"use server";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";

export async function createClient(formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const billingAddress = String(formData.get("billingAddress") ?? "").trim() || null;
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) {
    throw new Error("Client name is required");
  }

  const client = await prisma.client.create({
    data: { name, billingAddress, parentId },
  });

  redirect(`/clients/${client.id}`);
}

export async function createContact(clientId: string, formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const isPrimary = formData.get("isPrimary") === "on";
  const isBilling = formData.get("isBilling") === "on";
  const portalAccess = formData.get("portalAccess") === "on";

  if (!firstName || !lastName || !email) {
    throw new Error("First name, last name, and email are required");
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
}
