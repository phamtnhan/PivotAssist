"use client";

import { useEffect, useState } from "react";
import { AdminAppShell } from "@/components/AdminAppShell";
import { CheckCircle, Receipt } from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";
import { adminBillingCopy } from "@/lib/i18n-admin";
import { apiErrorText } from "@/lib/api-errors";

type InvoiceRow = {
  id: string;
  planId: string;
  amountVnd: number;
  status: string;
  transferContent: string;
  provider: string;
  createdAt: string;
  user?: { fullName: string; email: string };
};

export default function AdminBillingPage() {
  const { locale } = useLocale();
  const copy = adminBillingCopy(locale);
  const statusLabel = (status: string) =>
    status === "PAID" ? copy.paid : status === "CANCELLED" ? copy.cancelled : copy.pending;
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadInvoices() {
    const response = await fetch("/api/admin/billing", { cache: "no-store" }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) return;
    setInvoices(payload.invoices ?? []);
  }

  useEffect(() => {
    void loadInvoices();
  }, []);

  const act = async (invoiceId: string, action: "confirm" | "cancel") => {
    const response = await fetch("/api/admin/billing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, action }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setNotice(
      payload?.message ?? apiErrorText(payload, locale, response?.ok ? copy.updated : copy.fail),
    );
    await loadInvoices();
  };

  return (
    <AdminAppShell>
      <div className="max-w-[1100px] mx-auto space-y-5 pb-16">
        <header>
          <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-wider text-[#45474D]">
            <Receipt size={14} /> {copy.eyebrow}
          </div>
          <h1 className="text-[28px] font-[450] tracking-tight mt-1">{copy.title}</h1>
          <p className="text-[13px] text-[#45474D] mt-1">{copy.lead}</p>
        </header>
        {notice && (
          <div className="rounded-2xl border border-[#CEEAD6] bg-[#E6F4EA] px-4 py-3 text-[13px] text-[#137333]">
            {notice}
          </div>
        )}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#F8F9FA] text-[11px] font-mono uppercase text-[#45474D]">
              <tr>
                <th className="px-4 py-3">{copy.colCustomer}</th>
                <th className="px-4 py-3">{copy.colMemo}</th>
                <th className="px-4 py-3">{copy.colPlan}</th>
                <th className="px-4 py-3">{copy.colAmt}</th>
                <th className="px-4 py-3">{copy.colStatus}</th>
                <th className="px-4 py-3 text-right">{copy.colAct}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(33,34,38,0.06)]">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-[#45474D]">
                    {copy.empty}
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3">
                      <div className="font-[450]">{invoice.user?.fullName}</div>
                      <div className="text-[12px] text-[#45474D]">{invoice.user?.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{invoice.transferContent}</td>
                    <td className="px-4 py-3">{invoice.planId}</td>
                    <td className="px-4 py-3">
                      {invoice.amountVnd.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}đ
                    </td>
                    <td className="px-4 py-3">{statusLabel(invoice.status)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                        <button
                          type="button"
                          onClick={() => void act(invoice.id, "confirm")}
                          className="inline-flex items-center gap-1 rounded-full bg-[#121317] text-white px-3 py-1.5 text-[12px]"
                        >
                          <CheckCircle size={13} /> {copy.confirm}
                        </button>
                      )}
                      {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                        <button
                          type="button"
                          onClick={() => void act(invoice.id, "cancel")}
                          className="text-[12px] text-[#C5221F]"
                        >
                          {copy.cancel}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminAppShell>
  );
}
