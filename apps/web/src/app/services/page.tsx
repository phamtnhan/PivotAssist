"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Minus,
  CaretDown,
  Sparkle,
  Copy,
  CheckCircle,
  WarningCircle,
  QrCode,
  Receipt,
  ShieldCheck,
  X,
  CreditCard,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { servicesCatalog } from "@/lib/i18n-services";
import { apiErrorText } from "@/lib/api-errors";
import { useUser } from "@/lib/useUser";

export default function ServicesPage() {
  const { t, locale } = useLocale();
  const catalog = servicesCatalog(locale);
  const { user } = useUser();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("pro");
  const [momoConfigured, setMomoConfigured] = useState(false);
  const [vietqrConfigured, setVietqrConfigured] = useState(false);
  const [billingMode, setBillingMode] = useState<"free-local" | "vietqr">("vietqr");
  const [checkoutNotice, setCheckoutNotice] = useState<{
    message: string;
    isError?: boolean;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState<string | null>(null);

  // User subscription state
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [remainingSessions, setRemainingSessions] = useState<number | null>(null);

  const [checkoutInvoice, setCheckoutInvoice] = useState<{
    id: string;
    planId: string;
    amountVnd: number;
    status: string;
    provider?: string;
    transferContent: string;
    qrImageUrl?: string | null;
    accountNoMasked?: string | null;
    accountName?: string | null;
    payUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/runtime/status", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) return;
        if (payload.billing?.mode === "free-local" || payload.billing?.mode === "vietqr")
          setBillingMode(payload.billing.mode);
        setMomoConfigured(Boolean(payload.billing?.momoConfigured));
        setVietqrConfigured(Boolean(payload.billing?.vietqrConfigured));
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/profile", { cache: "no-store" })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (res.ok && payload?.success && payload.user?.preferencesJson) {
          const prefs = payload.user.preferencesJson;
          if (typeof prefs.plan === "string") setCurrentPlan(prefs.plan.toLowerCase());
          if (typeof prefs.remainingSessions === "number")
            setRemainingSessions(prefs.remainingSessions);
        }
      })
      .catch(() => null);
  }, [user]);

  useEffect(() => {
    if (!checkoutNotice) return;
    const timer = setTimeout(() => setCheckoutNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [checkoutNotice]);

  useEffect(() => {
    const invoiceId = checkoutInvoice?.id;
    if (!invoiceId || checkoutInvoice?.status === "PAID") return;
    let cancelled = false;
    const poll = async () => {
      const response = await fetch("/api/billing/invoices", { cache: "no-store" }).catch(
        () => null,
      );
      const payload = await response?.json().catch(() => null);
      const latest = Array.isArray(payload?.invoices)
        ? payload.invoices.find((invoice: { id?: unknown }) => invoice.id === invoiceId)
        : null;
      if (cancelled || !latest) return;
      setCheckoutInvoice((current) => (current ? { ...current, ...latest } : current));
      if (latest.status === "PAID") {
        setCheckoutNotice({ message: catalog.paidRecorded, isError: false });
        const profileResponse = await fetch("/api/profile", { cache: "no-store" }).catch(
          () => null,
        );
        const profilePayload = await profileResponse?.json().catch(() => null);
        const prefs = profilePayload?.user?.preferencesJson;
        if (!cancelled && prefs) {
          if (typeof prefs.plan === "string") setCurrentPlan(prefs.plan.toLowerCase());
          if (typeof prefs.remainingSessions === "number")
            setRemainingSessions(prefs.remainingSessions);
        }
      }
    };
    const timer = window.setInterval(() => {
      void poll();
    }, 5000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [checkoutInvoice?.id, checkoutInvoice?.status, catalog.paidRecorded]);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleCheckout = async (planId: string, provider: "vietqr" | "momo") => {
    setIsCreatingInvoice(`${planId}-${provider}`);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, provider }),
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (payload?.invoice) {
        setCheckoutInvoice({ ...payload.invoice, payUrl: payload.payUrl, provider });
      }
      const planItem = catalog.plans.find((p) => p.id === planId);
      const isSuccess = Boolean(response?.ok && payload?.success);
      setCheckoutNotice({
        message:
          payload?.message ??
          (response?.ok
            ? catalog.invoiceMade.replace("{name}", planItem?.name ?? planId)
            : catalog.loginNeed),
        isError: !isSuccess,
      });
    } finally {
      setIsCreatingInvoice(null);
    }
  };

  const handleConfirmPaid = async () => {
    if (!checkoutInvoice) return;
    setIsSubmittingConfirm(true);
    try {
      const response = await fetch("/api/billing/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: checkoutInvoice.id }),
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      const isSuccess = Boolean(response?.ok && payload?.success);
      setCheckoutNotice({
        message:
          payload?.message ?? (isSuccess ? catalog.paidRecorded : "Không thể xác nhận thanh toán."),
        isError: !isSuccess,
      });
      if (isSuccess) {
        const profileResponse = await fetch("/api/profile", { cache: "no-store" }).catch(
          () => null,
        );
        const profilePayload = await profileResponse?.json().catch(() => null);
        const prefs = profilePayload?.user?.preferencesJson;
        if (prefs) {
          if (typeof prefs.plan === "string") setCurrentPlan(prefs.plan.toLowerCase());
          if (typeof prefs.remainingSessions === "number")
            setRemainingSessions(prefs.remainingSessions);
        }
      }
      setCheckoutInvoice(null);
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  const planDisplayName = (id: string) => {
    if (id === "starter") return catalog.starterName;
    if (id === "pro") return catalog.proName;
    if (id === "master") return catalog.masterName;
    return locale === "en" ? "Free Member" : "Gói Miễn Phí";
  };

  return (
    <div className="max-w-[1240px] mx-auto animate-in fade-in duration-300 font-sans pb-24">
      {/* =========================================================================
          1. HEADER & VALUE PROPOSITION
          ========================================================================= */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[rgba(183,191,217,0.14)] text-[#121317] text-[11.5px] font-[450] tracking-tight mb-3">
          <Sparkle size={13} weight="fill" className="text-[#1A73E8]" />
          {t("servicesEyebrow")}
        </div>
        <h1 className="font-sans font-[450] text-3xl sm:text-4xl text-[#121317] tracking-[-0.02em] mb-3">
          {t("servicesTitle")}
        </h1>
        <p className="text-[14.5px] text-[#45474D] leading-relaxed font-normal">
          {t("servicesLead")}
        </p>
      </div>

      {/* =========================================================================
          USER SUBSCRIPTION STATUS BANNER (SYNCHRONIZED UI)
          ========================================================================= */}
      {user ? (
        <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 sm:p-6 mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white border border-[rgba(33,34,38,0.08)] flex items-center justify-center text-[#1A73E8] shrink-0 shadow-2xs">
              <ShieldCheck size={22} weight="duotone" />
            </div>
            <div>
              <div className="text-[11.5px] font-mono uppercase tracking-wider text-[#45474D]">
                {catalog.userStatusTitle}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-[15px] font-[450] text-[#121317]">
                  {planDisplayName(currentPlan)}
                </span>
                <span className="text-[12px] text-[#45474D]">·</span>
                <span className="text-[13px] text-[#1A73E8] font-[450] bg-[#E8F0FE] px-2.5 py-0.5 rounded-full border border-[#D2E3FC]">
                  {remainingSessions !== null
                    ? catalog.sessionsCount.replace("{n}", String(remainingSessions))
                    : catalog.unlimitedSessions}
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-[450] text-[#121317] hover:text-[#1A73E8] bg-white border border-[rgba(33,34,38,0.12)] px-4 py-2 rounded-full transition-all shrink-0 hover:border-[#1A73E8]/30 shadow-2xs self-start sm:self-center"
          >
            <Receipt size={14} />
            {catalog.viewInvoiceHistory}
          </Link>
        </div>
      ) : null}

      {/* =========================================================================
          2. THE 3 PRICING TIERS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mb-16">
        {catalog.plans.map((plan) => {
          const isUserPlan = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={cn(
                "rounded-[28px] p-7 flex flex-col justify-between transition-all duration-200 cursor-pointer relative bg-white shadow-2xs",
                plan.isPopular
                  ? "border-2 border-[#121317] shadow-md ring-4 ring-black/[0.03] lg:-translate-y-2 z-10"
                  : "border border-[rgba(33,34,38,0.08)] hover:border-[rgba(33,34,38,0.18)]",
              )}
            >
              {/* Popular or Current Plan Badge */}
              {isUserPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white bg-[#137333] text-[10.5px] font-[450] uppercase tracking-wider px-3.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                  <Check size={11} weight="bold" />
                  {catalog.currentPlanBadge}
                </div>
              ) : "badge" in plan && plan.badge ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white bg-[#121317] text-[10.5px] font-[450] uppercase tracking-wider px-3.5 py-0.5 rounded-full shadow-xs">
                  {plan.badge}
                </div>
              ) : null}

              <div>
                {/* Plan Header */}
                <div className="mb-4">
                  <h3 className="font-sans font-[450] text-[20px] text-[#121317]">{plan.name}</h3>
                  <p className="text-[12.5px] text-[#45474D] mt-1 min-h-[36px] leading-relaxed font-normal">
                    {plan.highlightText}
                  </p>
                </div>

                {/* Price Display */}
                <div className="py-4 border-y border-[rgba(33,34,38,0.06)] mb-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[32px] font-[450] text-[#121317] tracking-tight font-sans">
                      {plan.price}
                    </span>
                    <span className="text-[13px] text-[#45474D] font-normal">{plan.unit}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-[12px]">
                    {plan.originalPrice && (
                      <span className="text-[#45474D]/60 line-through">{plan.originalPrice}</span>
                    )}
                    {plan.discountBadge && (
                      <span className="bg-[#E6F4EA] text-[#137333] font-[450] px-2 py-0.5 rounded-full border border-[#CEEAD6]">
                        {plan.discountBadge}
                      </span>
                    )}
                    <span className="text-[#45474D] ml-auto font-normal">{plan.duration}</span>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-8">
                  <div className="text-[11px] font-[450] uppercase tracking-wider text-[#45474D] mb-2 font-mono">
                    {catalog.included}
                  </div>
                  {plan.features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-[13px] text-[#121317] leading-snug font-normal"
                    >
                      <div className="w-4 h-4 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={11} weight="bold" />
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={
                    (billingMode === "vietqr" && !vietqrConfigured) ||
                    isCreatingInvoice === `${plan.id}-vietqr`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCheckout(plan.id, "vietqr");
                  }}
                  className={cn(
                    "w-full py-3 px-4 rounded-full font-[450] text-[13.5px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-60",
                    plan.isPopular || isUserPlan
                      ? "bg-[#121317] hover:bg-[#2D3139] text-white"
                      : "bg-[#121317] hover:bg-[#2D3139] text-white",
                  )}
                >
                  <QrCode size={16} />
                  <span>
                    {isCreatingInvoice === `${plan.id}-vietqr`
                      ? "Đang tạo hóa đơn..."
                      : isUserPlan
                        ? catalog.renewPlan
                        : plan.ctaText}
                  </span>
                  <ArrowRight size={14} weight="bold" />
                </button>

                <button
                  type="button"
                  disabled={true}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCheckout(plan.id, "momo");
                  }}
                  className="w-full py-2.5 px-4 rounded-full font-[450] text-[12.5px] border border-[rgba(33,34,38,0.12)] text-[#121317] hover:bg-[#F8F9FA] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CreditCard size={15} />
                  <span>Thanh toán MoMo đang bảo trì</span>
                </button>

                <div className="text-center text-[11px] text-[#45474D] pt-1 font-normal">
                  {vietqrConfigured
                    ? "QR ngân hàng tĩnh đang nhận yêu cầu"
                    : "QR ngân hàng đang bảo trì"}{" "}
                  · Admin sẽ xác nhận gói thủ công sau khi bạn bấm xác nhận đã chuyển khoản.
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {checkoutNotice && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border px-5 py-3 text-[13px] shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2",
            checkoutNotice.isError
              ? "border-[#FAD2CF] bg-[#FCE8E6] text-[#C5221F]"
              : "border-[#CEEAD6] bg-[#E6F4EA] text-[#137333]",
          )}
          role="status"
        >
          {checkoutNotice.isError ? (
            <WarningCircle size={16} weight="fill" />
          ) : (
            <CheckCircle size={16} weight="fill" />
          )}
          <span>{checkoutNotice.message}</span>
        </div>
      )}

      {/* Enterprise Modern Checkout Modal */}
      {checkoutInvoice && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 sm:p-7 shadow-2xl border border-[rgba(33,34,38,0.08)] relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setCheckoutInvoice(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#F8F9FA] hover:bg-[#EBEDF0] text-[#45474D] flex items-center justify-center transition-colors cursor-pointer"
              aria-label={catalog.close}
            >
              <X size={16} weight="bold" />
            </button>

            {/* Modal Header */}
            <div className="mb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F0FE] text-[#1A73E8] text-[11px] font-mono font-[450] uppercase tracking-wider mb-2">
                <ShieldCheck size={13} weight="bold" />
                {checkoutInvoice.provider === "momo" ? catalog.eWallet : catalog.bankTransfer}
              </div>
              <h2 className="text-[20px] font-[450] text-[#121317] tracking-tight">
                {checkoutInvoice.provider === "momo" ? catalog.payMomo : catalog.payVietqr}
              </h2>
              <p className="text-[13px] text-[#45474D] mt-1">
                {catalog.payPlan
                  .replace("{plan}", planDisplayName(checkoutInvoice.planId))
                  .replace(
                    "{amount}",
                    checkoutInvoice.amountVnd.toLocaleString(locale === "en" ? "en-US" : "vi-VN"),
                  )
                  .replace("{status}", checkoutInvoice.status)}
              </p>
            </div>

            {/* QR Code / MoMo Action Area */}
            <div className="bg-[#F8F9FA] rounded-2xl p-5 border border-[rgba(33,34,38,0.06)] flex flex-col items-center mb-5">
              {checkoutInvoice.provider === "momo" &&
              (checkoutInvoice.payUrl || checkoutInvoice.qrImageUrl) ? (
                <div className="w-full text-center space-y-3">
                  {checkoutInvoice.qrImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={checkoutInvoice.qrImageUrl}
                      alt="MoMo QR"
                      className="mx-auto w-52 h-52 rounded-2xl bg-white p-2 border border-[rgba(33,34,38,0.08)] shadow-2xs"
                    />
                  ) : null}
                  <a
                    href={checkoutInvoice.payUrl || checkoutInvoice.qrImageUrl || "#"}
                    className="inline-flex w-full justify-center items-center gap-2 rounded-full bg-[#A50064] hover:bg-[#880052] text-white py-3 text-[13.5px] font-[450] transition-colors shadow-xs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {catalog.openMomo}
                    <ArrowRight size={14} weight="bold" />
                  </a>
                </div>
              ) : checkoutInvoice.qrImageUrl ? (
                <div className="text-center space-y-2">
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={checkoutInvoice.qrImageUrl}
                      alt="VietQR PivotAssist"
                      className="w-56 h-56 rounded-2xl bg-white p-2 border border-[rgba(33,34,38,0.08)] shadow-xs mx-auto"
                    />
                  </div>
                  <p className="text-[12px] text-[#45474D] font-normal">{catalog.scanToPay}</p>
                </div>
              ) : (
                <p className="text-[13px] text-[#45474D] py-4">{catalog.vietqrOff}</p>
              )}
            </div>

            {/* Transfer Details with 1-Click Copy Helpers */}
            <div className="space-y-2 mb-6">
              {/* Memo / Transfer Note */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[rgba(33,34,38,0.08)] hover:border-[rgba(33,34,38,0.18)] transition-colors">
                <div>
                  <div className="text-[11px] font-mono text-[#45474D] uppercase">
                    {catalog.transferNote}
                  </div>
                  <div className="text-[14px] font-mono font-[500] text-[#1A73E8]">
                    {checkoutInvoice.transferContent}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(checkoutInvoice.transferContent, "memo")}
                  className="px-3 py-1.5 rounded-full text-[12px] font-[450] bg-[#F8F9FA] hover:bg-[#EBEDF0] text-[#121317] border border-[rgba(33,34,38,0.08)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedField === "memo" ? (
                    <>
                      <CheckCircle size={14} weight="fill" className="text-[#34A853]" />
                      <span className="text-[#34A853]">{catalog.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>{catalog.copy}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Amount */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[rgba(33,34,38,0.08)] hover:border-[rgba(33,34,38,0.18)] transition-colors">
                <div>
                  <div className="text-[11px] font-mono text-[#45474D] uppercase">
                    {catalog.amountToPay}
                  </div>
                  <div className="text-[14px] font-[500] text-[#121317]">
                    {checkoutInvoice.amountVnd.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}{" "}
                    VND
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(String(checkoutInvoice.amountVnd), "amount")}
                  className="px-3 py-1.5 rounded-full text-[12px] font-[450] bg-[#F8F9FA] hover:bg-[#EBEDF0] text-[#121317] border border-[rgba(33,34,38,0.08)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedField === "amount" ? (
                    <>
                      <CheckCircle size={14} weight="fill" className="text-[#34A853]" />
                      <span className="text-[#34A853]">{catalog.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>{catalog.copy}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Account Number */}
              {checkoutInvoice.accountNoMasked ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[rgba(33,34,38,0.08)]">
                  <div>
                    <div className="text-[11px] font-mono text-[#45474D] uppercase">
                      {catalog.accountNo}
                    </div>
                    <div className="text-[13.5px] font-mono text-[#121317]">
                      {checkoutInvoice.accountNoMasked}
                    </div>
                  </div>
                  {checkoutInvoice.accountName ? (
                    <div className="text-right text-[12px] text-[#45474D]">
                      {checkoutInvoice.accountName}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Notice */}
              <div className="text-[11.5px] text-[#D93025] bg-[#FCE8E6] p-2.5 rounded-xl border border-[#FAD2CF] leading-relaxed">
                {catalog.importantMemoNote}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isSubmittingConfirm}
                onClick={handleConfirmPaid}
                className="flex-1 rounded-full bg-[#121317] hover:bg-[#2D3139] text-white py-3 text-[13.5px] font-[450] flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
              >
                <CheckCircle size={16} weight="bold" />
                <span>{isSubmittingConfirm ? "Đang ghi nhận..." : catalog.paidConfirm}</span>
              </button>
              <button
                type="button"
                onClick={() => setCheckoutInvoice(null)}
                className="rounded-full border border-[rgba(33,34,38,0.14)] hover:bg-[#F8F9FA] px-5 py-3 text-[13px] font-[450] text-[#121317] transition-colors cursor-pointer"
              >
                {catalog.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. REAL-WORLD IMPACT STATS
          ========================================================================= */}
      <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-8 mb-16 shadow-2xs">
        <div className="text-center text-[13px] text-[#45474D] leading-relaxed">
          {catalog.impact}
        </div>
      </div>

      {/* =========================================================================
          4. DETAILED FEATURE COMPARISON TABLE
          ========================================================================= */}
      <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 mb-16 shadow-2xs">
        <div className="mb-6">
          <h2 className="font-sans font-[450] text-xl text-[#121317]">{catalog.compareTitle}</h2>
          <p className="text-[13px] text-[#45474D] mt-0.5 font-normal">{catalog.compareLead}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[rgba(33,34,38,0.06)]">
                <th className="pb-3 font-[450] text-[#121317] w-2/5">{catalog.compareFeature}</th>
                <th className="pb-3 font-[450] text-[#121317] text-center w-1/5">
                  {catalog.starterName}
                </th>
                <th className="pb-3 font-[450] text-[#1A73E8] text-center w-1/5">
                  {catalog.proName}
                </th>
                <th className="pb-3 font-[450] text-[#121317] text-center w-1/5">
                  {catalog.masterName}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(33,34,38,0.06)]">
              {catalog.comparison.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F8F9FA] transition-colors">
                  <td className="py-3.5 text-[#121317] font-normal pr-4">{item.name}</td>

                  {/* Starter */}
                  <td className="py-3.5 text-center">
                    {typeof item.starter === "boolean" ? (
                      item.starter ? (
                        <Check size={16} weight="bold" className="text-[#34A853] mx-auto" />
                      ) : (
                        <Minus size={16} className="text-[#45474D]/30 mx-auto" />
                      )
                    ) : (
                      <span className="font-[450] text-[#121317]">{item.starter}</span>
                    )}
                  </td>

                  {/* Pro */}
                  <td className="py-3.5 text-center bg-[#E8F0FE]/40 font-[450] text-[#1A73E8]">
                    {typeof item.pro === "boolean" ? (
                      item.pro ? (
                        <Check size={16} weight="bold" className="text-[#1A73E8] mx-auto" />
                      ) : (
                        <Minus size={16} className="text-[#45474D]/30 mx-auto" />
                      )
                    ) : (
                      <span>{item.pro}</span>
                    )}
                  </td>

                  {/* Master */}
                  <td className="py-3.5 text-center">
                    {typeof item.master === "boolean" ? (
                      item.master ? (
                        <Check size={16} weight="bold" className="text-[#34A853] mx-auto" />
                      ) : (
                        <Minus size={16} className="text-[#45474D]/30 mx-auto" />
                      )
                    ) : (
                      <span className="font-[450] text-[#121317]">{item.master}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          5. FAQ ACCORDION
          ========================================================================= */}
      <div className="max-w-3xl mx-auto bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-8 shadow-2xs">
        <h2 className="font-sans font-[450] text-xl text-[#121317] mb-6 text-center">
          {catalog.faqTitle}
        </h2>

        <div className="divide-y divide-[rgba(33,34,38,0.06)]">
          {catalog.faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <div key={index} className="py-4">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between gap-4 text-left font-[450] text-[14px] text-[#121317] hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <CaretDown
                    size={16}
                    weight="bold"
                    className={cn(
                      "text-[#45474D] shrink-0 transition-transform duration-200",
                      isOpen && "rotate-180 text-[#1A73E8]",
                    )}
                  />
                </button>

                {isOpen && (
                  <p className="text-[13px] text-[#45474D] mt-2.5 leading-relaxed pr-6 animate-in fade-in duration-200 font-normal">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
