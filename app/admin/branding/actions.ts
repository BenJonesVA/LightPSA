"use server";

import { Permission, UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/rbac";
import { updateSettings } from "@/lib/settings";
import { saveLogoFile, MAX_LOGO_BYTES, MAX_LOGO_MB } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/components/ui/action-form";

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function updateBranding(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_BRANDING, UserRole.ADMIN, UserRole.MANAGER);

  const companyName = String(formData.get("companyName") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const orgModeRaw = String(formData.get("orgMode") ?? "MSP");
  const orgMode = orgModeRaw === "ENTERPRISE" ? "ENTERPRISE" : "MSP";

  if (!companyName) {
    return { error: "Company name is required" };
  }

  const logo = formData.get("logo");
  let logoMimeType: string | undefined;

  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return { error: `Logo exceeds the ${MAX_LOGO_MB}MB limit.` };
    }
    if (!ALLOWED_LOGO_TYPES.includes(logo.type)) {
      return { error: "Logo must be a PNG, JPEG, WebP, or SVG image." };
    }
    await saveLogoFile(Buffer.from(await logo.arrayBuffer()));
    logoMimeType = logo.type;
  }

  await updateSettings({
    companyName,
    tagline,
    orgMode,
    ...(logoMimeType ? { logoMimeType } : {}),
  });

  revalidatePath("/", "layout");
  return null;
}
