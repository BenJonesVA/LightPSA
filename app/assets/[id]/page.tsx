import Link from "next/link";
import { notFound } from "next/navigation";
import { Permission, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { getOrgLabels } from "@/lib/settings";
import { parseFieldSchema, parseCustomFieldValues } from "@/lib/asset-fields";
import { updateAsset, deleteAsset } from "../actions";
import { ActionForm } from "@/components/ui/action-form";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { AssetCategoryFields } from "@/components/ui/asset-category-fields";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff();
  const canManage =
    staff.role === UserRole.ADMIN ||
    staff.role === UserRole.MANAGER ||
    (staff.permissions?.includes(Permission.MANAGE_ASSETS) ?? false);
  const labels = await getOrgLabels();

  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { client: true, category: true },
  });

  if (!asset) {
    notFound();
  }

  const [ticketAssets, categories, clients] = await Promise.all([
    prisma.ticketAsset.findMany({
      where: { assetId: id },
      include: { ticket: { include: { board: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assetCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const updateAssetForAsset = updateAsset.bind(null, asset.id);
  const deleteAssetForAsset = deleteAsset.bind(null, asset.id);

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
    fields: parseFieldSchema(category.fieldSchema),
  }));
  const currentFieldSchema = parseFieldSchema(asset.category.fieldSchema);
  const currentCustomFields = parseCustomFieldValues(asset.customFields);

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
        {canManage ? (
          <>
            <ActionForm action={updateAssetForAsset} className="grid grid-cols-2 gap-3 p-4">
              <input
                name="name"
                placeholder="Name"
                required
                defaultValue={asset.name}
                className="col-span-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg sm:col-span-1"
              />
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1 block text-[11px] font-medium text-fg-subtle">
                  {labels.client}
                </label>
                <select
                  name="clientId"
                  required
                  defaultValue={asset.clientId}
                  className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <AssetCategoryFields
                categories={categoryOptions}
                categoryLabel="Type"
                initialCategoryId={asset.categoryId}
                initialValues={currentCustomFields}
              />
              <input
                name="serialNumber"
                placeholder="Serial number"
                defaultValue={asset.serialNumber ?? ""}
                className="col-span-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg sm:col-span-1"
              />
              <label className="col-span-2 flex items-center gap-2 text-sm text-fg-muted sm:col-span-1">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={asset.isActive}
                  className="rounded border-border-strong accent-accent"
                />
                Active
              </label>
              <textarea
                name="notes"
                placeholder="Notes"
                rows={3}
                defaultValue={asset.notes ?? ""}
                className="col-span-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
              />
              <Button type="submit" variant="primary" className="col-span-2 sm:col-span-1">
                Save
              </Button>
            </ActionForm>
            <div className="flex justify-end border-t border-border p-4">
              <DeleteButton action={deleteAssetForAsset} label="Delete asset" />
            </div>
          </>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Type</dt>
              <dd className="mt-0.5 text-fg">{asset.category.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Serial number</dt>
              <dd className="mt-0.5 font-mono text-fg">{asset.serialNumber ?? "—"}</dd>
            </div>
            {currentFieldSchema.map((field) => (
              <div key={field.key}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                  {field.label}
                </dt>
                <dd className="mt-0.5 text-fg">{currentCustomFields[field.key] ?? "—"}</dd>
              </div>
            ))}
            <div className="col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Notes</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-fg-muted">{asset.notes ?? "—"}</dd>
            </div>
          </dl>
        )}
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
              <div className="flex items-center gap-4">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
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
