import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { Card } from "@/components/ui/card";

export default async function AssetsPage() {
  await requireStaff();

  const assets = await prisma.asset.findMany({
    include: { client: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Assets</h1>
      </div>

      {assets.length === 0 ? (
        <Card className="px-5 py-6">
          <p className="text-sm text-fg-muted">No assets yet.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Serial number</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-row-py font-medium text-fg">
                    <Link href={`/assets/${asset.id}`} className="hover:text-accent">
                      {asset.name}
                    </Link>
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">{asset.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-row-py">
                    <Link href={`/clients/${asset.clientId}`} className="text-accent hover:underline">
                      {asset.client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-row-py font-mono text-fg-muted">{asset.serialNumber ?? "—"}</td>
                  <td className="px-4 py-row-py">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        asset.isActive ? "text-green bg-green-bg" : "text-slate bg-slate-bg"
                      }`}
                    >
                      <span className={`h-[7px] w-[7px] rounded-full ${asset.isActive ? "bg-green" : "bg-slate"}`} />
                      {asset.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
