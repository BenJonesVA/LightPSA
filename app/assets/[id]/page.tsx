import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();

  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!asset) {
    notFound();
  }

  const ticketAssets = await prisma.ticketAsset.findMany({
    where: { assetId: id },
    include: { ticket: { include: { board: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-fg">{asset.name}</h1>
          <p className="mt-[3px] text-[13.5px] text-fg-muted">
            <Link href={`/clients/${asset.client.id}`} className="text-accent hover:underline">
              {asset.client.name}
            </Link>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            asset.isActive ? "text-green bg-green-bg" : "text-slate bg-slate-bg"
          }`}
        >
          <span className={`h-[7px] w-[7px] rounded-full ${asset.isActive ? "bg-green" : "bg-slate"}`} />
          {asset.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Details</h2>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Type</dt>
            <dd className="mt-0.5 text-fg">{asset.type.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Serial number</dt>
            <dd className="mt-0.5 font-mono text-fg">{asset.serialNumber ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-fg-muted">{asset.notes ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Tickets</h2>
        </CardHeader>
        <ul className="divide-y divide-grid">
          {ticketAssets.map(({ ticket }) => (
            <li key={ticket.id} className="flex items-center justify-between px-4 py-row-py text-sm">
              <div>
                <Link href={`/tickets/${ticket.id}`} className="font-medium text-fg hover:text-accent">
                  TKT-{ticket.id}
                </Link>{" "}
                <span className="text-fg-muted">{ticket.title}</span>
                <div className="text-xs text-fg-subtle">{ticket.board.name}</div>
              </div>
              <StatusBadge status={ticket.status} />
            </li>
          ))}
          {ticketAssets.length === 0 && (
            <li className="px-4 py-8 text-center text-fg-subtle">No tickets linked to this asset yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
