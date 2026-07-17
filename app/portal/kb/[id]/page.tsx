import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { MarkdownContent } from "@/components/ui/markdown-content";

export default async function PortalKbArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireClientSession();
  const { id } = await params;

  // isInternal: false is baked into the query, not checked after fetching —
  // a guessed internal article id must 404, never be fetched then hidden.
  const article = await prisma.kbArticle.findFirst({
    where: { id, isInternal: false },
    include: { board: { select: { name: true } } },
  });

  if (!article) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/portal/kb" className="text-sm text-fg-subtle hover:text-fg">
        ← Back to Knowledge Base
      </Link>

      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-fg">{article.title}</h1>
        {article.board && <p className="mt-1 text-[13px] text-fg-subtle">{article.board.name}</p>}
      </div>

      <Card className="rounded-2xl p-6">
        <MarkdownContent markdown={article.body} className="text-[15px] text-fg" />
      </Card>
    </div>
  );
}
