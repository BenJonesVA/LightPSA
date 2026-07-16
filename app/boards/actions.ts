"use server";

import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DeleteActionState } from "@/components/ui/delete-button";

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

export async function updateBoard(id: string, formData: FormData) {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!name) {
    throw new Error("Board name is required");
  }

  await prisma.board.update({
    where: { id },
    data: {
      name,
      description: description || null,
      isActive,
    },
  });

  revalidatePath("/boards");
  revalidatePath(`/boards/${id}`);
}

// Returns { error } instead of throwing for the expected/guarded failure —
// see components/ui/delete-button.tsx for why: a thrown Error's message gets
// redacted by Next.js in production builds, turning this into a blank crash
// screen instead of the friendly message below.
export async function deleteBoard(id: string, _prevState: DeleteActionState, _formData: FormData): Promise<DeleteActionState> {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  try {
    await prisma.board.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "Cannot delete a board that still has tickets — deactivate it instead." };
    }
    throw error;
  }

  revalidatePath("/boards");
  redirect("/boards");
}
