import type { Prisma } from "@prisma/client";
import { prisma } from "@pivotassist/db";
import {
  PAYABLE_INVOICE_STATUSES,
  billingModeFromEnv,
  isFreeLocalBillingAllowed,
  isPayableInvoiceStatus,
} from "@/lib/billing-policy";
import { asPreferences, toInputJsonValue } from "@/lib/user-preferences";

export { isFreeLocalBillingAllowed, isPayableInvoiceStatus };

export const BILLING_PLANS = {
  starter: { planId: "starter", sessionsCount: 5, amountVnd: 99_000, days: 15, label: "Khởi Động" },
  pro: { planId: "pro", sessionsCount: 15, amountVnd: 199_000, days: 45, label: "Chuyên Nghiệp" },
  master: { planId: "master", sessionsCount: 50, amountVnd: 499_000, days: 180, label: "Đột Phá" },
} as const;

export type BillingPlanId = keyof typeof BILLING_PLANS;

export function billingMode(): "free-local" | "vietqr" {
  return billingModeFromEnv();
}

export function vietQrConfig() {
  const bankBin = process.env.BILLING_BANK_BIN?.trim() ?? "";
  const accountNo = process.env.BILLING_ACCOUNT_NO?.trim() ?? "";
  const accountName = process.env.BILLING_ACCOUNT_NAME?.trim() ?? "";
  const staticQrUrl = process.env.BILLING_STATIC_QR_URL?.trim() ?? "";
  return { bankBin, accountNo, accountName, staticQrUrl, configured: Boolean(staticQrUrl) };
}

export function maskAccount(accountNo: string): string {
  if (accountNo.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, accountNo.length - 4))}${accountNo.slice(-4)}`;
}

export function vietQrImageUrl(input: { amountVnd: number; addInfo: string }): string | null {
  const config = vietQrConfig();
  if (!config.configured) return null;
  return config.staticQrUrl;
}

export function transferContentFor(invoiceId: string): string {
  return `PA${invoiceId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10)
    .toUpperCase()}`;
}

type InvoiceRow = {
  id: string;
  userId: string;
  planId: string;
  sessionsCount: number;
  status: string;
  provider: string;
};

async function creditInvoiceInTx(tx: Prisma.TransactionClient, invoice: InvoiceRow) {
  const account = await tx.user.findUnique({
    where: { id: invoice.userId },
    select: { preferencesJson: true },
  });
  const current = asPreferences(account?.preferencesJson);
  const activated = Array.isArray(current.activatedInvoiceIds)
    ? current.activatedInvoiceIds.filter((item): item is string => typeof item === "string")
    : [];
  if (activated.includes(invoice.id)) return;
  await tx.user.update({
    where: { id: invoice.userId },
    data: {
      preferencesJson: toInputJsonValue({
        ...current,
        plan: invoice.planId,
        remainingSessions: Number(current.remainingSessions ?? 0) + invoice.sessionsCount,
        billingProvider:
          invoice.provider || (billingMode() === "free-local" ? "free-local" : "vietqr"),
        billingStatus: "ACTIVE",
        activatedInvoiceIds: [...activated, invoice.id],
      }),
    },
  });
}

/** Idempotent credit apply after the invoice row is already PAID. */
export async function activatePaidInvoice(invoice: InvoiceRow) {
  await prisma.$transaction((tx) => creditInvoiceInTx(tx, invoice));
}

export async function markInvoicePaidAndActivate(input: {
  invoiceId: string;
  userId?: string;
  confirmedById?: string;
  provider?: string;
}): Promise<
  | { ok: true; invoice: InvoiceRow; alreadyPaid: boolean }
  | { ok: false; reason: "not_found" | "not_payable" }
> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.billingInvoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice || (input.userId && invoice.userId !== input.userId)) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (invoice.status === "PAID") {
      await creditInvoiceInTx(tx, invoice);
      return { ok: true as const, invoice, alreadyPaid: true };
    }
    if (!isPayableInvoiceStatus(invoice.status)) {
      return { ok: false as const, reason: "not_payable" as const };
    }
    const moved = await tx.billingInvoice.updateMany({
      where: { id: invoice.id, status: { in: [...PAYABLE_INVOICE_STATUSES] } },
      data: {
        status: "PAID",
        paidAt: new Date(),
        confirmedById: input.confirmedById,
        provider: input.provider || invoice.provider,
      },
    });
    if (moved.count === 0) {
      const again = await tx.billingInvoice.findUnique({ where: { id: invoice.id } });
      if (again?.status === "PAID") {
        await creditInvoiceInTx(tx, again);
        return { ok: true as const, invoice: again, alreadyPaid: true };
      }
      return { ok: false as const, reason: "not_payable" as const };
    }
    const paid = await tx.billingInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    await creditInvoiceInTx(tx, paid);
    return { ok: true as const, invoice: paid, alreadyPaid: false };
  });
}
