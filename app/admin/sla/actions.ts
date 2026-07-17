"use server";

import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/components/ui/action-form";

export async function updateSlaPolicy(id: string, _prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_SLA, UserRole.ADMIN, UserRole.MANAGER);

  const responseTargetMinutes = Number(formData.get("responseTargetMinutes"));
  const resolutionTargetMinutes = Number(formData.get("resolutionTargetMinutes"));
  const isActive = formData.get("isActive") === "on";

  if (
    !Number.isInteger(responseTargetMinutes) ||
    responseTargetMinutes <= 0 ||
    !Number.isInteger(resolutionTargetMinutes) ||
    resolutionTargetMinutes <= 0
  ) {
    return { error: "Response and resolution targets must be positive whole numbers of minutes" };
  }

  await prisma.slaPolicy.update({
    where: { id },
    data: { responseTargetMinutes, resolutionTargetMinutes, isActive },
  });

  revalidatePath("/admin/sla");
  return null;
}
