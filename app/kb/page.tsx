import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function KbPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaff();

  const params = await searchParams;
  const boardId = typeof params.boardId === "string" ? params.boardId : undefined;
  const categoryId = typeof params.categoryId === "string" ? params.categoryId : undefined;
  const q = typeof params.q === "string" ? params.q.trim() : undefined;

  const where: Prisma.KbArticleWhereInput = {
    ...(boardId ? { boardId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [articles, boards, categories] = await Promise.all([
    prisma.kbArticle.findMany({
      where,
      include: { board: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.board.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Knowledge Base</h1>
        <Link href="/kb/new">
          <Button variant="primary">
            <span className="text-[15px] leading-none">+</span>New article
          </Button>
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-[6px] block text-xs font-medium text-fg-muted">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Title or body…"
            className="rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
          />
        </div>
        <div>
          <label className="mb-[6px] block text-xs font-medium text-fg-muted">Board</label>
          <select
            name="boardId"
            defaultValue={boardId ?? ""}
            className="rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
          >
            <option value="">All</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-[6px] block text-xs font-medium text-fg-muted">Category</label>
          <select
            name="categoryId"
            defaultValue={categoryId ?? ""}
            className="rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg"
          >
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
        <Link href="/kb" className="text-sm text-fg-subtle underline">
          Clear
        </Link>
      </form>

      <Card>
        {articles.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No articles match the current filters.</p>
        ) : (
          <ul className="divide-y divide-grid">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/kb/${article.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-row-py hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-fg">{article.title}</div>
                    <div className="mt-0.5 text-xs text-fg-subtle">
                      {article.board?.name ?? "No board"}
                      {article.category ? ` · ${article.category.name}` : ""}
                      {" · "}
                      Updated {article.updatedAt.toLocaleDateString()}
                    </div>
                  </div>
                  {article.isInternal && (
                    <span className="flex-none rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-amber">
                      Internal
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
