"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  Permission,
  UserRole,
  InvoiceStatus,
  type Contract,
  type ContractRate,
  type WorkType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import type { FormActionState } from "@/components/ui/action-form";

// ── Rate resolution ─────────────────────────────────────────
//
// No dollar-amount rate resolution exists elsewhere in the app today (the
// billing review queue only ever sums hours). This ladder is derived from
// the schema's own documented intent:
//   - ContractRate ("Per-role/work-type rate overrides for Time & Materials
//     contracts") lets a contract override the hourly rate for a specific
//     role, a specific work type, both, or neither (a contract-wide rate).
//   - Contract.defaultHourlyRate ("TIME_AND_MATERIALS fields") is the
//     contract's fallback rate when no ContractRate row matches.
// Most specific match wins: role+workType > workType-only > role-only >
// contract-wide override > contract default. A TimeLog with no contract, or
// whose contract has neither a matching rate nor a default, has no
// resolvable dollar amount and is skipped rather than billed at a
// fabricated $0.
function resolveHourlyRate(
  contract: (Contract & { rates: ContractRate[] }) | null,
  role: UserRole,
  workType: WorkType
): number | null {
  if (!contract) return null;

  const exact = contract.rates.find((r) => r.role === role && r.workType === workType);
  if (exact) return Number(exact.hourlyRate);

  const byWorkType = contract.rates.find((r) => r.role === null && r.workType === workType);
  if (byWorkType) return Number(byWorkType.hourlyRate);

  const byRole = contract.rates.find((r) => r.role === role && r.workType === null);
  if (byRole) return Number(byRole.hourlyRate);

  const general = contract.rates.find((r) => r.role === null && r.workType === null);
  if (general) return Number(general.hourlyRate);

  if (contract.defaultHourlyRate !== null && contract.defaultHourlyRate !== undefined) {
    return Number(contract.defaultHourlyRate);
  }

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type GenerateInvoiceResult = { error: string } | { invoiceId: string };

// Finds all approved & locked, not-yet-invoiced TimeLog/Expense rows for a
// client within a period, prices them, and creates one DRAFT Invoice plus
// one InvoiceLineItem per row in a single transaction. TimeLog/Expense link
// to Client only via Ticket, so the client scope is `ticket: { clientId }`.
export async function generateInvoice(
  clientId: string,
  periodStart: string,
  periodEnd: string
): Promise<GenerateInvoiceResult> {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);

  if (!clientId) {
    return { error: "Please select a client." };
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { error: "Please provide a valid period start and end date." };
  }
  // Treat periodEnd as inclusive of the whole day.
  const endInclusive = new Date(end);
  endInclusive.setUTCHours(23, 59, 59, 999);

  const [timeLogs, expenses] = await Promise.all([
    prisma.timeLog.findMany({
      where: {
        ticket: { clientId },
        isApproved: true,
        isLocked: true,
        startTime: { gte: start, lte: endInclusive },
        invoiceLineItems: { none: {} },
      },
      include: { contract: { include: { rates: true } }, user: true },
    }),
    prisma.expense.findMany({
      where: {
        ticket: { clientId },
        isApproved: true,
        isLocked: true,
        createdAt: { gte: start, lte: endInclusive },
        invoiceLineItems: { none: {} },
      },
    }),
  ]);

  type LineItemInput = {
    description: string;
    amount: number;
    timeLogId?: string;
    expenseId?: string;
  };
  const lineItems: LineItemInput[] = [];
  let skippedForRate = 0;

  for (const log of timeLogs) {
    const rate = resolveHourlyRate(log.contract, log.user.role, log.workType);
    if (rate === null) {
      skippedForRate++;
      continue;
    }
    const hours = log.durationMinutes / 60;
    lineItems.push({
      description: `${log.workType} — ${hours.toFixed(2)}h @ $${rate.toFixed(2)}/hr (TKT-${log.ticketId})`,
      amount: round2(hours * rate),
      timeLogId: log.id,
    });
  }

  for (const expense of expenses) {
    lineItems.push({
      description: `${expense.type}: ${expense.description} (TKT-${expense.ticketId})`,
      amount: round2(Number(expense.amount)),
      expenseId: expense.id,
    });
  }

  if (lineItems.length === 0) {
    const note =
      skippedForRate > 0
        ? ` (${skippedForRate} approved/locked time log${skippedForRate === 1 ? "" : "s"} skipped — no billing rate could be resolved)`
        : "";
    return {
      error: `No approved and locked, uninvoiced time logs or expenses were found for that client and period.${note}`,
    };
  }

  const totalAmount = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        clientId,
        periodStart: start,
        periodEnd: end,
        status: InvoiceStatus.DRAFT,
        totalAmount,
      },
    });

    await tx.invoiceLineItem.createMany({
      data: lineItems.map((li) => ({
        invoiceId: created.id,
        description: li.description,
        amount: li.amount,
        timeLogId: li.timeLogId,
        expenseId: li.expenseId,
      })),
    });

    return created;
  });

  revalidatePath("/invoices");
  revalidatePath("/billing");

  return { invoiceId: invoice.id };
}

// Thin FormActionState adapter over generateInvoice for use with
// <ActionForm> on app/invoices/new/page.tsx — keeps generateInvoice's own
// signature (clientId, periodStart, periodEnd) intact for direct/reuse
// callers while fitting the app's inline-error form convention.
export async function generateInvoiceAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const clientId = String(formData.get("clientId") ?? "");
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");

  const result = await generateInvoice(clientId, periodStart, periodEnd);
  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/invoices/${result.invoiceId}`);
}

export async function markInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
  await requirePermission(Permission.MANAGE_BILLING, UserRole.ADMIN, UserRole.MANAGER);

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}
