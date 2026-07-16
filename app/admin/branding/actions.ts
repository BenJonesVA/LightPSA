"use server";

import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/rbac";
import { updateSettings } from "@/lib/settings";
import { saveLogoFile, MAX_LOGO_BYTES, MAX_LOGO_MB } from "@/lib/storage";
import { revalidatePath } from "next/cache";

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function updateBranding(formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const companyName = String(formData.get("companyName") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const orgModeRaw = String(formData.get("orgMode") ?? "MSP");
  const orgMode = orgModeRaw === "ENTERPRISE" ? "ENTERPRISE" : "MSP";

  if (!companyName) {
    throw new Error("Company name is required");
  }

  const logo = formData.get("logo");
  let logoMimeType: string | undefined;

  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      throw new Error(`Logo exceeds the ${MAX_LOGO_MB}MB limit.`);
    }
    if (!ALLOWED_LOGO_TYPES.includes(logo.type)) {
      throw new Error("Logo must be a PNG, JPEG, WebP, or SVG image.");
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
}
