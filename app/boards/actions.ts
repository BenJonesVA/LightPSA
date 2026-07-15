"use server";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export async function createBoard(formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    throw new Error("Board name is required");
  }

  await prisma.board.create({
    data: {
      name,
      description: description || null,
    },
  });

  redirect("/boards");
}
