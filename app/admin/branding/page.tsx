import { Permission, UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateBranding } from "./actions";
import { ActionForm } from "@/components/ui/action-form";

export default async function BrandingAdminPage() {
  await requirePermission(Permission.MANAGE_BRANDING, UserRole.ADMIN, UserRole.MANAGER);

  const settings = await getSettings();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Branding</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Company name, tagline, and logo shown across the app and the sign-in page.
        </p>
      </div>

      <Card className="p-5">
        <ActionForm action={updateBranding} encType="multipart/form-data" className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl border border-border-strong bg-surface-2">
              {settings.logoMimeType ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/branding/logo?v=${settings.updatedAt.getTime()}`}
                  alt="Current logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-fg-subtle">No logo</span>
              )}
            </div>
            <label className="block flex-1">
              <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">
                Logo (PNG, JPEG, WebP, or SVG — max 2MB)
              </span>
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="block w-full text-[13px] text-fg-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-[6px] file:text-[13px] file:font-semibold file:text-fg hover:file:bg-surface-3"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">
              Company name
            </span>
            <input
              type="text"
              name="companyName"
              required
              defaultValue={settings.companyName}
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">
              Tagline
            </span>
            <input
              type="text"
              name="tagline"
              defaultValue={settings.tagline ?? ""}
              placeholder="PSA — Professional Services Automation"
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">
              Organization mode
            </span>
            <p className="mb-2 text-[12px] text-fg-muted">
              Enterprise mode relabels Clients as Departments and Contacts as
              Employees, and hides Billing/Contracts. No data is changed —
              this only affects labels and visibility.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer flex-col gap-1 rounded-xl border border-border-strong px-3 py-2.5 hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-weak">
                <input
                  type="radio"
                  name="orgMode"
                  value="MSP"
                  defaultChecked={settings.orgMode === "MSP"}
                  className="sr-only"
                />
                <span className="text-[13px] font-semibold text-fg">MSP</span>
                <span className="text-[11px] text-fg-subtle">Clients, Contacts, Billing/Contracts</span>
              </label>
              <label className="flex cursor-pointer flex-col gap-1 rounded-xl border border-border-strong px-3 py-2.5 hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-weak">
                <input
                  type="radio"
                  name="orgMode"
                  value="ENTERPRISE"
                  defaultChecked={settings.orgMode === "ENTERPRISE"}
                  className="sr-only"
                />
                <span className="text-[13px] font-semibold text-fg">Enterprise</span>
                <span className="text-[11px] text-fg-subtle">Departments, Employees, no Billing</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Save
            </Button>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
