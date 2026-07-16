import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

// Self-healing singleton row — first read creates it, so no seed step is
// required and the row always exists by the time any caller needs it.
export async function getSettings() {
  return prisma.setting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export async function updateSettings(data: {
  companyName: string;
  tagline: string | null;
  logoMimeType?: string | null;
}) {
  return prisma.setting.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}
