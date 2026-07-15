"use server";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function updateSlaPolicy(id: string, formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const responseTargetMinutes = Number(formData.get("responseTargetMinutes"));
  const resolutionTargetMinutes = Number(formData.get("resolutionTargetMinutes"));
  const isActive = formData.get("isActive") === "on";

  if (
    !Number.isInteger(responseTargetMinutes) ||
    responseTargetMinutes <= 0 ||
    !Number.isInteger(resolutionTargetMinutes) ||
    resolutionTargetMinutes <= 0
  ) {
    throw new Error("Response and resolution targets must be positive whole numbers of minutes");
  }

  await prisma.slaPolicy.update({
    where: { id },
    data: { responseTargetMinutes, resolutionTargetMinutes, isActive },
  });

  revalidatePath("/admin/sla");
}
