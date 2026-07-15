import { UserRole } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { toggleAutomationRule } from "@/app/automation/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACTION_LABELS: Record<string, string> = {
  ASSIGN_TECHNICIAN: "Assign technician",
  SEND_EMAIL_NOTIFICATION: "Send email notification",
  CHANGE_STATUS: "Change status",
  CHANGE_PRIORITY: "Change priority",
};

const TRIGGER_LABELS: Record<string, string> = {
  TICKET_CREATED: "Ticket created",
  STATUS_CHANGED: "Status changed",
  PRIORITY_ESCALATED: "Priority escalated",
  IDLE_TIME_EXCEEDED: "Idle time exceeded",
};

function RuleToggle({ isActive }: { isActive: boolean }) {
  return (
    <button
      type="submit"
      aria-pressed={isActive}
      aria-label={isActive ? "Deactivate rule" : "Activate rule"}
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

export default async function AutomationRulesPage() {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const rules = await prisma.automationRule.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      conditionBoard: true,
      conditionClient: true,
      actionAssignee: true,
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight text-fg">Automation Rules</h1>
        <Link href="/automation/new">
          <Button variant="primary">
            <span className="text-[15px] leading-none">+</span>New Rule
          </Button>
        </Link>
      </div>

      {rules.length === 0 ? (
        <Card className="px-5 py-6">
          <p className="text-sm text-fg-muted">No automation rules yet. Create the first one.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Trigger</th>
                <th className="px-4 py-2.5">Conditions</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const conditions: string[] = [];
                if (rule.conditionBoard) conditions.push(`Board: ${rule.conditionBoard.name}`);
                if (rule.conditionPriority) conditions.push(`Priority: ${rule.conditionPriority}`);
                if (rule.conditionClient) conditions.push(`Client: ${rule.conditionClient.name}`);
                if (rule.conditionIdleMinutes) conditions.push(`Idle ≥ ${rule.conditionIdleMinutes}m`);
                if (conditions.length === 0) conditions.push("Any");

                let actionDetail = "";
                if (rule.actionType === "ASSIGN_TECHNICIAN" && rule.actionAssignee) {
                  actionDetail = ` → ${rule.actionAssignee.name}`;
                } else if (rule.actionType === "CHANGE_STATUS" && rule.actionStatus) {
                  actionDetail = ` → ${rule.actionStatus}`;
                } else if (rule.actionType === "CHANGE_PRIORITY" && rule.actionPriority) {
                  actionDetail = ` → ${rule.actionPriority}`;
                }

                return (
                  <tr key={rule.id} className="border-b border-grid last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-row-py font-medium text-fg">{rule.name}</td>
                    <td className="px-4 py-row-py text-fg-muted">
                      {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
                      {rule.triggerType === "IDLE_TIME_EXCEEDED" && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-bg px-2 py-0.5 text-xs font-medium text-blue">
                          checked every 15m
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-row-py text-fg-muted">{conditions.join(", ")}</td>
                    <td className="px-4 py-row-py text-fg-muted">
                      {ACTION_LABELS[rule.actionType] ?? rule.actionType}
                      {actionDetail}
                    </td>
                    <td className="px-4 py-row-py">
                      <form action={toggleAutomationRule.bind(null, rule.id, !rule.isActive)}>
                        <RuleToggle isActive={rule.isActive} />
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
