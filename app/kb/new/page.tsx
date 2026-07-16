import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { isEnterpriseMode } from "@/lib/settings";
import { createArticle } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

export default async function NewKbArticlePage() {
  await requireStaff();

  const isEnterprise = await isEnterpriseMode();

  const [boards, categories] = await Promise.all([
    prisma.board.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">New KB article</h1>

      <Card className="mt-6 p-6">
        <form action={createArticle} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">Title</label>
            <input
              type="text"
              name="title"
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Body</label>
            <RichTextEditor name="body" defaultValue="" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted">Board</label>
              <select
                name="boardId"
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="">None</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-muted">Category</label>
              <select
                name="categoryId"
                className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              >
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input type="checkbox" name="isInternal" />
            Internal only (hidden from the {isEnterprise ? "employee" : "client"} portal)
          </label>

          <div className="flex justify-end gap-3">
            <a href="/kb">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Create article
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
