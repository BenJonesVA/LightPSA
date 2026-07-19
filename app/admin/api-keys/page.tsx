import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { DeleteButton } from "@/components/ui/delete-button";
import { createApiKey, toggleApiKeyActive, deleteApiKey } from "./actions";

const inputClass =
  "rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";

function ActiveToggle({ isActive }: { isActive: boolean }) {
  return (
    <button
      type="submit"
      aria-pressed={isActive}
      aria-label={isActive ? "Deactivate key" : "Activate key"}
      className="inline-flex items-center gap-2"
    >
      <span
        className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors ${
          isActive ? "bg-accent" : "bg-surface-3"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            isActive ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
      <span className={`text-[12.5px] font-medium ${isActive ? "text-fg" : "text-fg-subtle"}`}>
        {isActive ? "Active" : "Inactive"}
      </span>
    </button>
  );
}

export default async function ApiKeysAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ newKey?: string }>;
}) {
  await requireRole(UserRole.ADMIN);

  const { newKey } = await searchParams;

  const apiKeys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">API Keys</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Machine credentials for monitoring/RMM integrations to create tickets via{" "}
          <code>POST /api/integrations/monitoring</code>.
        </p>
      </div>

      {newKey && (
        <Card className="border-amber bg-amber-bg p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-fg">Copy this key now — it won&apos;t be shown again</p>
            <Link href="/admin/api-keys" className="text-[12.5px] font-medium text-fg-subtle hover:text-fg">
              Dismiss
            </Link>
          </div>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Only a hash of this key is stored. If you lose it, delete the key and create a new one.
          </p>
          <code className="mt-3 block break-all rounded-lg border border-border-strong bg-surface px-3 py-2 text-[12.5px] text-fg">
            {newKey}
          </code>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-[15px] font-semibold text-fg">New API key</h2>
        <ActionForm action={createApiKey} className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">Label</span>
            <input type="text" name="label" required className={`w-full ${inputClass}`} placeholder="e.g. NinjaOne" />
          </label>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm">
              Create key
            </Button>
          </div>
        </ActionForm>
      </Card>

      {apiKeys.length === 0 ? (
        <Card className="p-8 text-center text-fg-subtle">No API keys yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <CardHeader>
            <h2 className="text-[14.5px] font-semibold text-fg">Existing keys</h2>
          </CardHeader>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2.5">Label</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Last used</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((apiKey) => (
                <tr key={apiKey.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-row-py font-medium text-fg">{apiKey.label}</td>
                  <td className="px-4 py-row-py">
                    <ActionForm action={toggleApiKeyActive.bind(null, apiKey.id)}>
                      <ActiveToggle isActive={apiKey.isActive} />
                    </ActionForm>
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">
                    {apiKey.lastUsedAt ? apiKey.lastUsedAt.toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-row-py text-fg-muted">{apiKey.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-row-py text-right">
                    <DeleteButton action={deleteApiKey.bind(null, apiKey.id)} />
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
