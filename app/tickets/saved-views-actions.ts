"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export async function saveTicketFilter(name: string, query: Record<string, string>): Promise<void> {
  const user = await requireStaff();

  if (!name.trim()) return;

  await prisma.savedTicketFilter.create({
    data: {
      userId: user.id,
      name: name.trim(),
      query: query as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/tickets");
}

export async function deleteTicketFilter(id: string): Promise<void> {
  const user = await requireStaff();

  await prisma.savedTicketFilter.deleteMany({ where: { id, userId: user.id } });

  revalidatePath("/tickets");
}
