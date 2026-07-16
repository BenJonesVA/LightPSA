import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { getCurrentBillingPeriod } from "@/lib/billing-period";
import { createContact, createAsset, updateClient, deleteClient } from "../actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

const PERIOD_DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

const ASSET_TYPE_OPTIONS = [
  "WORKSTATION",
  "LAPTOP",
  "SERVER",
  "NETWORK_DEVICE",
  "PRINTER",
  "MOBILE_DEVICE",
  "OTHER",
] as const;

const CONTRACT_TYPE_STYLES: Record<string, { fg: string; bg: string }> = {
  RETAINER: { fg: "text-blue", bg: "bg-blue-bg" },
  MSP_FLAT_RATE: { fg: "text-violet", bg: "bg-violet-bg" },
  TIME_AND_MATERIALS: { fg: "text-green", bg: "bg-green-bg" },
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireStaff();
  const canManage = staff.role === UserRole.ADMIN || staff.role === UserRole.MANAGER;

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      contacts: { orderBy: { createdAt: "asc" } },
      contracts: { orderBy: { createdAt: "desc" } },
      assets: { orderBy: { createdAt: "asc" } },
      tickets: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          board: { select: { name: true } },
          assignee: { select: { name: true } },
        },
      },
    },
  });

  if (!client) {
    notFound();
  }

  const retainerContracts = client.contracts.filter(
    (contract) => contract.type === ContractType.RETAINER
  );

  // Each RETAINER contract has its own anchor day, so its current billing
  // period is computed and queried independently rather than in one shared
  // groupBy across all contracts.
  const periodDataByContractId: Record<
    string,
    { usedMinutes: number; periodStart: Date; periodEnd: Date }
  > = Object.fromEntries(
    await Promise.all(
      retainerContracts.map(async (contract) => {
        const { periodStart, periodEnd } = getCurrentBillingPeriod(contract.startDate);
        const result = await prisma.timeLog.aggregate({
          where: {
            contractId: contract.id,
            billable: true,
            startTime: { gte: periodStart, lt: periodEnd },
          },
          _sum: { durationMinutes: true },
        });
        return [
          contract.id,
          { usedMinutes: result._sum.durationMinutes ?? 0, periodStart, periodEnd },
        ] as const;
      })
    )
  );

  const createContactForClient = createContact.bind(null, client.id);
  const createAssetForClient = createAsset.bind(null, client.id);
  const updateClientForClient = updateClient.bind(null, client.id);
  const deleteClientForClient = deleteClient.bind(null, client.id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-fg">{client.name}</h1>
          {client.parent && (
            <p className="mt-[3px] text-[13.5px] text-fg-muted">
              Part of{" "}
              <Link href={`/clients/${client.parent.id}`} className="text-accent hover:underline">
                {client.parent.name}
              </Link>
            </p>
          )}
          {client.billingAddress && (
            <p className="mt-[3px] text-[13.5px] text-fg-muted">{client.billingAddress}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              client.isActive ? "text-green bg-green-bg" : "text-slate bg-slate-bg"
            }`}
          >
            <span className={`h-[7px] w-[7px] rounded-full ${client.isActive ? "bg-green" : "bg-slate"}`} />
            {client.isActive ? "Active" : "Inactive"}
          </span>
          {canManage && (
            <Link href="/clients/new">
              <Button variant="primary">
                <span className="text-[15px] leading-none">+</span>New client
              </Button>
            </Link>
          )}
        </div>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <h2 className="text-[13.5px] font-semibold text-fg">Details</h2>
          </CardHeader>
          <form action={updateClientForClient} className="grid grid-cols-2 gap-3 p-4">
            <input
              name="name"
              placeholder="Name"
              required
              defaultValue={client.name}
              className="col-span-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg sm:col-span-1"
            />
            <input
              name="billingAddress"
              placeholder="Billing address"
              defaultValue={client.billingAddress ?? ""}
              className="col-span-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg sm:col-span-1"
            />
            <label className="col-span-2 flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={client.isActive}
                className="rounded border-border-strong accent-accent"
              />
              Active
            </label>
            <Button type="submit" variant="primary" className="col-span-2 sm:col-span-1">
              Save
            </Button>
          </form>
          <div className="flex justify-end border-t border-border p-4">
            <DeleteButton action={deleteClientForClient} label="Delete client" />
          </div>
        </Card>
      )}

      {/* Contacts */}
      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Contacts</h2>
        </CardHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Roles</th>
              <th className="px-4 py-2.5">Portal</th>
            </tr>
          </thead>
          <tbody>
            {client.contacts.map((contact) => (
              <tr key={contact.id} className="border-b border-grid last:border-0">
                <td className="px-4 py-row-py font-medium text-fg">
                  {contact.firstName} {contact.lastName}
                </td>
                <td className="px-4 py-row-py text-fg-muted">{contact.email}</td>
                <td className="px-4 py-row-py text-fg-muted">{contact.title ?? "—"}</td>
                <td className="px-4 py-row-py">
                  <div className="flex gap-1">
                    {contact.isPrimary && (
                      <span className="rounded-full bg-violet-bg px-2 py-0.5 text-xs font-semibold text-violet">
                        Primary
                      </span>
                    )}
                    {contact.isBilling && (
                      <span className="rounded-full bg-amber-bg px-2 py-0.5 text-xs font-semibold text-amber">
                        Billing
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-row-py text-fg-muted">{contact.portalAccess ? "Yes" : "No"}</td>
              </tr>
            ))}
            {client.contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-subtle">
                  No contacts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {canManage && (
          <form
            action={createContactForClient}
            className="grid grid-cols-2 gap-3 border-t border-border p-4 sm:grid-cols-4"
          >
            <input
              name="firstName"
              placeholder="First name"
              required
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
            <input
              name="lastName"
              placeholder="Last name"
              required
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
            <input
              name="phone"
              placeholder="Phone"
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
            <input
              name="title"
              placeholder="Title"
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input type="checkbox" name="isPrimary" /> Primary
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input type="checkbox" name="isBilling" /> Billing
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input type="checkbox" name="portalAccess" /> Portal access
            </label>
            <Button type="submit" variant="primary" className="col-span-2 sm:col-span-4">
              Add contact
            </Button>
          </form>
        )}
      </Card>

      {/* Contracts */}
      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Contracts</h2>
        </CardHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Usage</th>
            </tr>
          </thead>
          <tbody>
            {client.contracts.map((contract) => {
              const isRetainer = contract.type === ContractType.RETAINER;
              const blockHours = contract.blockHoursPerPeriod
                ? Number(contract.blockHoursPerPeriod)
                : null;
              const periodData = periodDataByContractId[contract.id];
              const usedHours = (periodData?.usedMinutes ?? 0) / 60;
              const pctUsed = blockHours && blockHours > 0 ? (usedHours / blockHours) * 100 : 0;
              const overBlock = blockHours !== null && usedHours > blockHours;
              const periodLabel = periodData
                ? `${periodData.periodStart.toLocaleDateString("en-US", PERIOD_DATE_FORMAT)} – ${periodData.periodEnd.toLocaleDateString("en-US", PERIOD_DATE_FORMAT)}`
                : null;
              const typeStyle = CONTRACT_TYPE_STYLES[contract.type] ?? {
                fg: "text-slate",
                bg: "bg-slate-bg",
              };

              return (
                <tr key={contract.id} className="border-b border-grid last:border-0">
                  <td className="px-4 py-row-py font-medium text-fg">{contract.name}</td>
                  <td className="px-4 py-row-py">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeStyle.fg} ${typeStyle.bg}`}
                    >
                      {contract.type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">{contract.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-row-py">
                    {isRetainer && blockHours !== null ? (
                      <div className="min-w-[10rem]">
                        <div className="flex items-center justify-between text-xs">
                          <span className={overBlock ? "font-semibold text-red" : "text-fg-muted"}>
                            {usedHours.toFixed(1)} / {blockHours} hrs used
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={`h-full rounded-full ${overBlock ? "bg-red" : "bg-accent"}`}
                            style={{ width: `${Math.min(100, Math.max(0, pctUsed))}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-[11px] text-fg-subtle">
                          Current period{periodLabel ? `: ${periodLabel}` : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {client.contracts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-fg-subtle">
                  No contracts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Assets */}
      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Assets</h2>
        </CardHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Serial</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {client.assets.map((asset) => (
              <tr key={asset.id} className="border-b border-grid last:border-0">
                <td className="px-4 py-row-py font-medium text-fg">{asset.name}</td>
                <td className="px-4 py-row-py text-fg-muted">{asset.type.replace(/_/g, " ")}</td>
                <td className="px-4 py-row-py font-mono text-fg-muted">{asset.serialNumber ?? "—"}</td>
                <td className="px-4 py-row-py text-fg-muted">{asset.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
            {client.assets.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-fg-subtle">
                  No assets on file yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {canManage && (
          <form
            action={createAssetForClient}
            className="grid grid-cols-2 gap-3 border-t border-border p-4 sm:grid-cols-4"
          >
            <input
              name="name"
              placeholder="Name (e.g. Front desk PC)"
              required
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg sm:col-span-2"
            />
            <select
              name="type"
              defaultValue="WORKSTATION"
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            >
              {ASSET_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              name="serialNumber"
              placeholder="Serial number"
              className="col-span-1 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg"
            />
            <input
              name="notes"
              placeholder="Notes (optional)"
              className="col-span-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg sm:col-span-3"
            />
            <Button type="submit" variant="primary" className="col-span-1">
              Add asset
            </Button>
          </form>
        )}
      </Card>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <h2 className="text-[13.5px] font-semibold text-fg">Recent tickets</h2>
        </CardHeader>
        <ul className="divide-y divide-grid">
          {client.tickets.map((ticket) => (
            <li key={ticket.id} className="flex items-center justify-between px-4 py-row-py text-sm">
              <div>
                <Link href={`/tickets/${ticket.id}`} className="font-medium text-fg hover:text-accent">
                  TKT-{ticket.id}
                </Link>{" "}
                <span className="text-fg-muted">{ticket.title}</span>
                <div className="text-xs text-fg-subtle">
                  {ticket.board.name}
                  {ticket.assignee ? ` · ${ticket.assignee.name}` : ""}
                </div>
              </div>
              <StatusBadge status={ticket.status} />
            </li>
          ))}
          {client.tickets.length === 0 && (
            <li className="px-4 py-8 text-center text-fg-subtle">No tickets yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
