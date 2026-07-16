import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createCannedResponse, deleteCannedResponse, updateCannedResponse } from "./actions";

function truncate(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function BoardSelect({ boards, defaultValue }: { boards: { id: string; name: string }[]; defaultValue?: string }) {
  return (
    <select
      name="boardId"
      defaultValue={defaultValue ?? ""}
      className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
    >
      <option value="">All boards</option>
      {boards.map((board) => (
        <option key={board.id} value={board.id}>
          {board.name}
        </option>
      ))}
    </select>
  );
}

function PlaceholderHint() {
  return (
    <p className="mt-1 text-[11.5px] text-fg-subtle">
      Supports <code className="rounded bg-surface-2 px-1 py-0.5">{"{{client_name}}"}</code> and{" "}
      <code className="rounded bg-surface-2 px-1 py-0.5">{"{{ticket_id}}"}</code> placeholders.
    </p>
  );
}

export default async function CannedResponsesAdminPage() {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const [cannedResponses, boards] = await Promise.all([
    prisma.cannedResponse.findMany({ orderBy: { title: "asc" }, include: { board: true } }),
    prisma.board.findMany(),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Canned Responses</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Reusable reply templates for the ticket comment box.
        </p>
      </div>

      <Card className="p-4">
        <h2 className="text-[15px] font-semibold text-fg">New canned response</h2>
        <form action={createCannedResponse} className="mt-3 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Title</span>
            <input
              type="text"
              name="title"
              required
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Board scope</span>
            <BoardSelect boards={boards} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Body</span>
            <textarea
              name="body"
              required
              rows={4}
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
            />
            <PlaceholderHint />
          </label>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        {cannedResponses.map((canned) => (
          <Card key={canned.id} className="p-4">
            <form
              action={updateCannedResponse.bind(null, canned.id)}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg-subtle">
                  {canned.board ? canned.board.name : "All boards"}
                </span>
                <span className="text-xs text-fg-subtle">{truncate(canned.body)}</span>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Title</span>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={canned.title}
                  className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Board scope</span>
                <BoardSelect boards={boards} defaultValue={canned.boardId ?? ""} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Body</span>
                <textarea
                  name="body"
                  required
                  rows={4}
                  defaultValue={canned.body}
                  className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
                />
                <PlaceholderHint />
              </label>

              <div className="flex items-center justify-end gap-2">
                <Button type="submit" variant="primary" size="sm">
                  Save
                </Button>
              </div>
            </form>
            <form action={deleteCannedResponse.bind(null, canned.id)} className="mt-2 flex justify-end">
              <Button type="submit" variant="danger" size="sm">
                Delete
              </Button>
            </form>
          </Card>
        ))}

        {cannedResponses.length === 0 ? (
          <p className="text-[13.5px] text-fg-subtle">No canned responses yet.</p>
        ) : null}
      </div>
    </div>
  );
}
