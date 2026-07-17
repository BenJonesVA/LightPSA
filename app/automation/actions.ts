"use server";

import { UserRole, AutomationTrigger, AutomationAction, Permission, TicketPriority, TicketStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import type { FormActionState } from "@/components/ui/action-form";

const CREATABLE_TRIGGERS: AutomationTrigger[] = [
  AutomationTrigger.TICKET_CREATED,
  AutomationTrigger.STATUS_CHANGED,
  AutomationTrigger.PRIORITY_ESCALATED,
  AutomationTrigger.IDLE_TIME_EXCEEDED,
];

export async function createAutomationRule(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  await requirePermission(Permission.MANAGE_AUTOMATION, UserRole.ADMIN, UserRole.MANAGER);

  const name = String(formData.get("name") ?? "").trim();
  const triggerTypeRaw = String(formData.get("triggerType") ?? "");
  const actionTypeRaw = String(formData.get("actionType") ?? "");

  if (!name) {
    return { error: "Rule name is required" };
  }

  // Server-side re-check: IDLE_TIME_EXCEEDED has no scheduler to fire it yet.
  // Never trust the form's dead-trigger exclusion alone — someone could POST
  // a tampered value directly.
  if (!CREATABLE_TRIGGERS.includes(triggerTypeRaw as AutomationTrigger)) {
    throw new Error("Unsupported trigger type");
  }
  const triggerType = triggerTypeRaw as AutomationTrigger;

  if (!Object.values(AutomationAction).includes(actionTypeRaw as AutomationAction)) {
    throw new Error("Unsupported action type");
  }
  const actionType = actionTypeRaw as AutomationAction;

  const conditionBoardId = String(formData.get("conditionBoardId") ?? "").trim() || null;
  const conditionPriorityRaw = String(formData.get("conditionPriority") ?? "").trim();
  const conditionPriority = conditionPriorityRaw
    ? (conditionPriorityRaw as TicketPriority)
    : null;
  const conditionClientId = String(formData.get("conditionClientId") ?? "").trim() || null;

  // Only meaningful for IDLE_TIME_EXCEEDED — required for that trigger,
  // discarded for every other one so a stray form value can't create a
  // confusing half-configured rule of a different trigger type.
  let conditionIdleMinutes: number | null = null;
  if (triggerType === AutomationTrigger.IDLE_TIME_EXCEEDED) {
    const idleMinutesRaw = String(formData.get("conditionIdleMinutes") ?? "").trim();
    const parsed = Number(idleMinutesRaw);
    if (!idleMinutesRaw || !Number.isInteger(parsed) || parsed <= 0) {
      return { error: "Idle minutes must be a positive whole number for an idle-time rule" };
    }
    conditionIdleMinutes = parsed;
  }

  const actionAssigneeId = String(formData.get("actionAssigneeId") ?? "").trim() || null;
  const actionStatusRaw = String(formData.get("actionStatus") ?? "").trim();
  const actionStatus = actionStatusRaw ? (actionStatusRaw as TicketStatus) : null;
  const actionPriorityRaw = String(formData.get("actionPriority") ?? "").trim();
  const actionPriority = actionPriorityRaw ? (actionPriorityRaw as TicketPriority) : null;

  await prisma.automationRule.create({
    data: {
      name,
      triggerType,
      conditionBoardId,
      conditionPriority,
      conditionClientId,
      conditionIdleMinutes,
      actionType,
      actionAssigneeId: actionType === AutomationAction.ASSIGN_TECHNICIAN ? actionAssigneeId : null,
      actionStatus: actionType === AutomationAction.CHANGE_STATUS ? actionStatus : null,
      actionPriority: actionType === AutomationAction.CHANGE_PRIORITY ? actionPriority : null,
    },
  });

  redirect("/automation");
}

export async function toggleAutomationRule(id: string, isActive: boolean) {
  await requirePermission(Permission.MANAGE_AUTOMATION, UserRole.ADMIN, UserRole.MANAGER);

  await prisma.automationRule.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/automation");
}
