import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/rbac";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { addPortalComment } from "../../actions";

export default async function PortalTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClientSession();

  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  // Scoped in a single query — a contact must never be able to view another
  // client's ticket by guessing/incrementing the numeric id, and internal
  // notes must never be fetched at all (not just hidden in the UI).
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: user.clientId! },
    include: {
      board: true,
      comments: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        include: { authorUser: true, authorContact: true },
      },
    },
  });

  if (!ticket) notFound();

  async function submitComment(formData: FormData) {
    "use server";
    await addPortalComment(ticketId, formData);
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/portal/tickets" className="text-[14px] font-medium text-fg-muted hover:text-accent">
        ← Back to My Tickets
      </Link>

      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-fg">
          TKT-{ticket.id} · {ticket.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-[13px] text-fg-subtle">Board: {ticket.board.name}</span>
        </div>
      </div>

      <Card className="rounded-2xl p-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-subtle">Description</h2>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{ticket.description}</p>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="px-6 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-subtle">Comments</h2>
        </CardHeader>

        <ul className="flex flex-col divide-y divide-grid px-6">
          {ticket.comments.map((comment) => {
            const authorName = comment.authorUser
              ? comment.authorUser.name
              : comment.authorContact
                ? `${comment.authorContact.firstName} ${comment.authorContact.lastName}`
                : "Unknown";
            return (
              <li key={comment.id} className="py-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold text-fg">{authorName}</span>
                  <span className="text-[12.5px] text-fg-subtle">{comment.createdAt.toLocaleString()}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-fg-muted">
                  {comment.body}
                </p>
              </li>
            );
          })}
          {ticket.comments.length === 0 ? (
            <li className="py-6 text-center text-[14px] text-fg-subtle">No comments yet.</li>
          ) : null}
        </ul>

        <form action={submitComment} className="flex flex-col gap-3 border-t border-border px-6 py-5">
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Add a comment…"
            className="w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center px-6 py-3 text-[15px] sm:w-auto"
            >
              Add comment
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
