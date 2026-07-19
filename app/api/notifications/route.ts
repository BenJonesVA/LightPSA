import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";

// Polled by components/notification-bell.tsx on the same interval as
// app/tickets/[id]/auto-refresh.tsx. Scoped to the signed-in staff user only
// — there's no admin "view anyone's notifications" mode here.
export async function GET() {
  const user = await requireStaff();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({
      where: { userId: user.id, readAt: null },
    }),
  ]);

  return Response.json({ notifications, unreadCount });
}
