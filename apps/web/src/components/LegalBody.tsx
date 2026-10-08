"use client";

import { useLocale } from "@/lib/i18n";

export function LegalBody() {
  const { t } = useLocale();
  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-6">
      <h1 className="text-2xl font-[450] text-[#121317]">{t("legalTitle")}</h1>
      <p className="text-[14.5px] text-[#45474D] leading-relaxed">{t("legalLead")}</p>
      <section className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-6 space-y-3 text-[14px] text-[#45474D] leading-relaxed">
        <h2 className="text-[16px] font-[450] text-[#121317]">{t("legalDevice")}</h2>
        <p>{t("legalMic")}</p>
        <p>{t("legalCam")}</p>
        <p>{t("legalRefuse")}</p>
      </section>
      <p className="text-[13px] text-[#5F6368]">{t("legalLaw")}</p>
    </div>
  );
}
