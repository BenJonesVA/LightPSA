"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// No auth here on purpose — the unguessable CsatResponse id is the
// authorization boundary for this whole surface (see middleware.ts). The
// `respondedAt: null` guard makes a resubmitted/replayed form a no-op
// instead of overwriting an existing answer.
export async function submitCsatResponse(id: string, formData: FormData) {
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;

  const comment = String(formData.get("comment") ?? "").trim() || null;

  await prisma.csatResponse.updateMany({
    where: { id, respondedAt: null },
    data: { rating, comment, respondedAt: new Date() },
  });

  redirect(`/csat/${id}`);
}
