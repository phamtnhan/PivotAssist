"use client";

import { useEffect, useState } from "react";
import { AdminAppShell } from "@/components/AdminAppShell";
import {
  CurrencyDollar,
  Users,
  BuildingOffice,
  Cpu,
  ShieldCheck,
  CheckCircle,
  TrendUp,
} from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";
import { adminDashCopy } from "@/lib/i18n-user";
import { fillCopy } from "@/lib/i18n-enterprise";

function labelAuditAction(action: string, locale: "vi" | "en"): string {
  const vi: Record<string, string> = {
    "support.chat": "Chat hỗ trợ",
    "support.updated": "Cập nhật hỗ trợ",
    "support.requested": "Yêu cầu hỗ trợ",
    "practice_session.created": "Tạo buổi luyện",
    "interview.started": "Bắt đầu phỏng vấn",
    "interview.completed": "Kết thúc phỏng vấn",
    "application.created": "Nộp hồ sơ",
    "application.schedule_created": "Tạo phòng phỏng vấn",
    "resume.created": "Tải CV",
    "auth.login": "Đăng nhập",
    "admin.user_updated": "Cập nhật tài khoản",
    "admin.company_updated": "Cập nhật doanh nghiệp",
    "billing.invoice_confirmed": "Xác nhận thanh toán",
    "billing.invoice_created": "Tạo hóa đơn",
    "billing.invoice_cancelled": "Hủy hóa đơn",
    "application.status_updated": "Cập nhật hồ sơ",
    "application.withdrawn": "Rút hồ sơ",
    "application.schedule_updated": "Cập nhật lịch phòng",
    "job.updated": "Cập nhật tin tuyển",
    "job.archived": "Ẩn tin tuyển",
    "resume.updated": "Cập nhật CV",
    "profile.updated": "Cập nhật hồ sơ cá nhân",
    "enterprise.registered": "Đăng ký doanh nghiệp",
    "interview.reevaluated": "Chấm lại buổi luyện",
  };
  const en: Record<string, string> = {
    "support.chat": "Support chat",
    "support.updated": "Support updated",
    "support.requested": "Support request",
    "practice_session.created": "Practice started",
    "interview.started": "Interview started",
    "interview.completed": "Interview finished",
    "application.created": "Application sent",
    "application.schedule_created": "Interview room created",
    "resume.created": "CV uploaded",
    "auth.login": "Signed in",
    "admin.user_updated": "Account updated",
    "admin.company_updated": "Company updated",
    "billing.invoice_confirmed": "Payment confirmed",
    "billing.invoice_created": "Invoice created",
    "billing.invoice_cancelled": "Invoice cancelled",
    "application.status_updated": "Application updated",
    "application.withdrawn": "Application withdrawn",
    "application.schedule_updated": "Room schedule updated",
    "job.updated": "Listing updated",
    "job.archived": "Listing archived",
    "resume.updated": "CV updated",
    "profile.updated": "Profile updated",
    "enterprise.registered": "Company registered",
    "interview.reevaluated": "Session rescored",
  };
  return (locale === "en" ? en : vi)[action] ?? action.replace(/[._]/g, " ");
}

export default function AdminOverviewPage() {
  const { t, locale } = useLocale();
  const copy = adminDashCopy(locale);
  const [metrics, setMetrics] = useState<{
    users: number;
    candidates: number;
    recruiters: number;
    companies: number;
    jobs: number;
    applications: number;
    interviews: number;
    scored: number;
    paidAmountVnd?: number;
  } | null>(null);
  const [liveLogs, setLiveLogs] = useState<
    Array<{
      createdAt: string;
      action: string;
      resource: string;
      user?: { fullName?: string } | null;
    }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      const response = await fetch("/api/admin/overview", { cache: "no-store" }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (!cancelled && response?.ok && payload?.success) {
        setMetrics(payload.metrics);
        setLiveLogs(payload.recentLogs ?? []);
      }
    }
    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  const recentLogs = liveLogs.map((log) => ({
    time: new Date(log.createdAt).toLocaleTimeString(locale === "en" ? "en-GB" : "vi-VN"),
    type: labelAuditAction(log.action, locale),
    msg: `${log.user?.fullName ?? copy.system} · ${log.resource}`,
    status: copy.logged,
  }));

  return (
    <AdminAppShell>
      <div className="max-w-[1240px] mx-auto font-sans space-y-8 pb-20">
        {/* Header */}
        <div className="border-b border-[rgba(33,34,38,0.06)] pb-5">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#EA4335] uppercase tracking-wider mb-1">
            <ShieldCheck size={14} weight="fill" />
            <span>{copy.center}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-sans font-[450] text-[#121317] tracking-[-0.02em]">
            {t("adminOverviewTitle")}
          </h1>
          <p className="text-[13.5px] text-[#45474D] mt-1 font-normal">{t("adminOverviewLead")}</p>
        </div>

        {/* Top KPI Cards (Antigravity Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-[450] text-[#45474D] font-mono uppercase">
                {copy.rev}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#E6F4EA] text-[#137333] flex items-center justify-center">
                <CurrencyDollar size={16} weight="bold" />
              </div>
            </div>
            <div className="text-2xl font-[450] text-[#121317] font-mono">
              {metrics?.paidAmountVnd
                ? `${metrics.paidAmountVnd.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}đ`
                : copy.free}
            </div>
            <div className="text-[11.5px] text-[#137333] font-normal mt-1.5 flex items-center gap-1">
              <TrendUp size={13} weight="bold" />{" "}
              {metrics?.paidAmountVnd ? copy.paidHint : copy.noPay}
            </div>
          </div>

          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-[450] text-[#45474D] font-mono uppercase">
                {copy.people}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center">
                <Users size={16} weight="fill" />
              </div>
            </div>
            <div className="text-2xl font-[450] text-[#121317] font-mono">
              {metrics?.candidates.toLocaleString(locale === "en" ? "en-GB" : "vi-VN") ?? "—"}
            </div>
            <div className="text-[11.5px] text-[#45474D] mt-1.5 font-normal">{copy.peopleHint}</div>
          </div>

          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-[450] text-[#45474D] font-mono uppercase">
                {copy.firms}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center">
                <BuildingOffice size={16} weight="fill" />
              </div>
            </div>
            <div className="text-2xl font-[450] text-[#121317] font-mono">
              {metrics
                ? fillCopy(copy.firmsN, {
                    n: metrics.companies.toLocaleString(locale === "en" ? "en-GB" : "vi-VN"),
                  })
                : "—"}
            </div>
            <div className="text-[11.5px] text-[#137333] mt-1.5 font-normal flex items-center gap-1">
              <CheckCircle size={13} weight="fill" /> {copy.firmsHint}
            </div>
          </div>

          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-[450] text-[#45474D] font-mono uppercase">
                {copy.sessions}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#FEF7E0] text-[#B06000] flex items-center justify-center">
                <Cpu size={16} weight="bold" />
              </div>
            </div>
            <div className="text-2xl font-[450] text-[#1A73E8] font-mono">
              {metrics ? fillCopy(copy.sessionsN, { n: metrics.interviews }) : "—"}
            </div>
            <div className="text-[11.5px] text-[#45474D] mt-1.5 font-normal">
              {metrics ? fillCopy(copy.scored, { n: metrics.scored }) : copy.loading}
            </div>
          </div>
        </div>

        {/* Live System Audit Logs */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 sm:p-7 shadow-2xs space-y-4">
          <div className="border-b border-[rgba(33,34,38,0.06)] pb-4">
            <h3 className="font-sans font-[450] text-base text-[#121317]">{copy.logs}</h3>
            <p className="text-[12.5px] text-[#45474D] mt-0.5 font-normal">{copy.logsLead}</p>
          </div>

          <div className="space-y-2.5">
            {recentLogs.length === 0 ? (
              <p className="text-[13px] text-[#45474D]">{copy.logsEmpty}</p>
            ) : (
              recentLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12.5px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#45474D] text-[11px] font-mono shrink-0">
                      {log.time}
                    </span>
                    <span className="font-mono font-medium text-[#1A73E8] text-[10.5px] bg-[#E8F0FE] border border-[#D2E3FC] px-2 py-0.5 rounded-full shrink-0">
                      {log.type}
                    </span>
                    <span className="text-[#121317] font-normal">{log.msg}</span>
                  </div>
                  <span className="text-[11px] text-[#137333] font-[450] bg-[#E6F4EA] px-2.5 py-0.5 rounded-full self-start sm:self-auto shrink-0">
                    {log.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminAppShell>
  );
}
