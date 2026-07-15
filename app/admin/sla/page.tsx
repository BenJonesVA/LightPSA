import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { PriorityBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateSlaPolicy } from "./actions";

const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"] as const;

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export default async function SlaAdminPage() {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const policies = await prisma.slaPolicy.findMany();
  const sorted = [...policies].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority as (typeof PRIORITY_ORDER)[number]) -
      PRIORITY_ORDER.indexOf(b.priority as (typeof PRIORITY_ORDER)[number])
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight text-fg">SLA Policies</h1>
        <p className="mt-[3px] text-[13.5px] text-fg-muted">
          Response and resolution targets per ticket priority.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map((policy) => (
          <Card key={policy.id} className="p-4">
            <form action={updateSlaPolicy.bind(null, policy.id)} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <PriorityBadge priority={policy.priority} />
                <span className="text-xs text-fg-subtle">
                  Currently: {formatMinutes(policy.responseTargetMinutes)} response /{" "}
                  {formatMinutes(policy.resolutionTargetMinutes)} resolution
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">
                    Response target (minutes)
                  </span>
                  <input
                    type="number"
                    name="responseTargetMinutes"
                    min={1}
                    required
                    defaultValue={policy.responseTargetMinutes}
                    className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-fg-subtle">
                    Resolution target (minutes)
                  </span>
                  <input
                    type="number"
                    name="resolutionTargetMinutes"
                    min={1}
                    required
                    defaultValue={policy.resolutionTargetMinutes}
                    className="w-full rounded-lg border border-border-strong bg-surface px-3 py-[7px] text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[13.5px] text-fg-muted">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={policy.isActive}
                    className="rounded border-border-strong accent-accent"
                  />
                  Active
                </label>
                <Button type="submit" variant="primary" size="sm">
                  Save
                </Button>
              </div>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
