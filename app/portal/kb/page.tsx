import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/rbac";
import { Card } from "@/components/ui/card";

export default async function PortalKbPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireClientSession();
  const { q } = await searchParams;
  const query = q?.trim();

  // isInternal: false is fetched, not filtered client-side — same reasoning
  // as the internal-comment scoping on portal ticket detail: an internal
  // article must never leave the database in the response at all.
  const articles = await prisma.kbArticle.findMany({
    where: {
      isInternal: false,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { body: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { board: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold tracking-tight text-fg">Knowledge Base</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="mb-2 block text-[13px] font-medium text-fg-muted">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search articles…"
            className="w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>
      </form>

      <Card className="rounded-2xl">
        {articles.length === 0 ? (
          <p className="px-6 py-10 text-center text-[15px] text-fg-muted">No articles found.</p>
        ) : (
          <ul className="divide-y divide-grid">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/portal/kb/${article.id}`}
                  className="flex flex-col gap-1 px-6 py-5 hover:bg-surface-2"
                >
                  <div className="text-[15px] font-semibold text-fg">{article.title}</div>
                  {article.board && <div className="text-[13px] text-fg-subtle">{article.board.name}</div>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
