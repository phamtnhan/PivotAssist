"use client";

import Link from "next/link";
import { LockSimple, House, ShieldSlash } from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";
import { useUser } from "@/lib/useUser";

export default function UnauthorizedPage() {
  const { t } = useLocale();
  const { user } = useUser();
  const homeHref =
    user?.role === "ADMIN"
      ? "/admin"
      : user?.role === "RECRUITER"
        ? "/enterprise/dashboard"
        : "/home";
  return (
    <div className="enterprise-register-page min-h-screen bg-[#F8F9FA] text-ink font-sans flex flex-col items-center justify-center p-6 text-center selection:bg-accent-deep/20">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center mb-6 shadow-xs">
        <LockSimple size={28} weight="bold" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[12px] font-bold uppercase tracking-wider mb-4">
        {t("unauthBadge")}
      </div>

      <h1 className="font-bold text-[32px] sm:text-[40px] text-ink tracking-tight leading-tight mb-3 max-w-lg">
        {t("unauthTitle")}
      </h1>

      <p className="text-[14.5px] text-ink-soft max-w-md mx-auto mb-8 leading-relaxed">
        {t("unauthLead")}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-2 bg-accent-deep hover:bg-accent-hover text-white px-6 py-3 rounded-xl font-bold text-[14px] transition-all shadow-sm shadow-accent-deep/20"
        >
          <House size={18} weight="fill" />
          {t("unauthHome")}
        </Link>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-white hover:bg-paper text-ink border border-mist-dark/80 px-6 py-3 rounded-xl font-bold text-[14px] transition-all shadow-2xs"
        >
          {t("unauthLogin")}
        </Link>
      </div>

      <div className="mt-16 text-[12px] text-ink-soft/70 flex items-center gap-1.5">
        <ShieldSlash size={16} className="text-rose-600" weight="fill" />
        {t("unauthFoot")}
      </div>
    </div>
  );
}
