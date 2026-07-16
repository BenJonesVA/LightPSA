import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { updateArticle } from "../../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

export default async function EditKbArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [article, boards, categories] = await Promise.all([
    prisma.kbArticle.findUnique({ where: { id } }),
    prisma.board.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!article) notFound();

  const submit = updateArticle.bind(null, article.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">Edit KB article</h1>

      <Card className="mt-6 p-6">
        <form action={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted">Title</label>
            <input
              type="text"
              name="title"
              defaultValue={article.title}
              required
              className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg-muted">Body</label>
            <RichTextEditor name="body" defaultValue={article.body} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted">Board</label>
              <select
                name="boardId"
                defaultValue={article.boardId ?? ""}
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
                defaultValue={article.categoryId ?? ""}
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
            <input type="checkbox" name="isInternal" defaultChecked={article.isInternal} />
            Internal only (hidden from the client portal)
          </label>

          <div className="flex justify-end gap-3">
            <a href={`/kb/${article.id}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
