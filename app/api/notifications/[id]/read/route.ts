import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";

// Scoped by { id, userId } together so this can never mark another user's
// notification read, even if they guess/enumerate an id.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;

  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
