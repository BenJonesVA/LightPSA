import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_ON_CLIENT"] as const;

export default async function BoardsPage() {
  const user = await requireStaff();
  const canCreateBoard = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;

  const boards = await prisma.board.findMany({
    orderBy: { name: "asc" },
  });

  const openCounts = await Promise.all(
    boards.map((board) =>
      prisma.ticket.count({
        where: {
          boardId: board.id,
          status: { in: [...OPEN_STATUSES] },
        },
      })
    )
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Boards</h1>
        {canCreateBoard && (
          <Link href="/boards/new">
            <Button variant="primary">
              <span className="text-[15px] leading-none">+</span>New board
            </Button>
          </Link>
        )}
      </div>

      {boards.length === 0 ? (
        <Card className="px-5 py-6">
          <p className="text-sm text-fg-muted">No boards yet. Create the first one.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Open tickets</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board, i) => (
                <tr key={board.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-row-py font-medium text-fg">
                    <Link href={`/tickets?boardId=${board.id}`} className="hover:text-accent">
                      {board.name}
                    </Link>
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">{board.description ?? "—"}</td>
                  <td className="px-4 py-row-py">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        board.isActive ? "text-green bg-green-bg" : "text-slate bg-slate-bg"
                      }`}
                    >
                      <span className={`h-[7px] w-[7px] rounded-full ${board.isActive ? "bg-green" : "bg-slate"}`} />
                      {board.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-row-py font-mono text-fg-muted">{openCounts[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
