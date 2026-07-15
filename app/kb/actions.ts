"use server";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { redirect } from "next/navigation";

// Open to any staff role, not just ADMIN/MANAGER — a KB works best when
// frontline techs actually write up the fixes they find, not just admins.
// Same trust model as ticket status updates: any staff member can edit any
// article, no per-author ownership lock.

export async function createArticle(formData: FormData) {
  const user = await requireStaff();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const boardId = formData.get("boardId") ? String(formData.get("boardId")) : null;
  const categoryId = formData.get("categoryId") ? String(formData.get("categoryId")) : null;
  const isInternal = formData.get("isInternal") === "on";

  if (!title || !body) {
    throw new Error("Title and body are required.");
  }

  const article = await prisma.kbArticle.create({
    data: { title, body, boardId, categoryId, isInternal, createdById: user.id },
  });

  redirect(`/kb/${article.id}`);
}

export async function updateArticle(articleId: string, formData: FormData) {
  await requireStaff();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const boardId = formData.get("boardId") ? String(formData.get("boardId")) : null;
  const categoryId = formData.get("categoryId") ? String(formData.get("categoryId")) : null;
  const isInternal = formData.get("isInternal") === "on";

  if (!title || !body) {
    throw new Error("Title and body are required.");
  }

  await prisma.kbArticle.update({
    where: { id: articleId },
    data: { title, body, boardId, categoryId, isInternal },
  });

  redirect(`/kb/${articleId}`);
}
