import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RichText } from "@/components/ui/rich-text";

export default async function KbArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const article = await prisma.kbArticle.findUnique({
    where: { id },
    include: { board: true, category: true, createdBy: { select: { name: true } } },
  });

  if (!article) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/kb" className="text-sm text-fg-subtle hover:text-fg">
        ← Back to Knowledge Base
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-fg">{article.title}</h1>
          <div className="mt-[10px] flex flex-wrap items-center gap-[10px] text-xs text-fg-subtle">
            {article.board && <span>{article.board.name}</span>}
            {article.category && <span>{article.category.name}</span>}
            <span>By {article.createdBy.name}</span>
            <span>Updated {article.updatedAt.toLocaleString()}</span>
            {article.isInternal && (
              <span className="rounded-full bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-amber">
                Internal only
              </span>
            )}
          </div>
        </div>
        <Link href={`/kb/${article.id}/edit`}>
          <Button variant="secondary">Edit</Button>
        </Link>
      </div>

      <Card className="p-5">
        <RichText html={article.body} className="text-[13.5px] text-fg" />
      </Card>
    </div>
  );
}
