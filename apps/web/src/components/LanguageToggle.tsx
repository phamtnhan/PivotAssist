"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      role="group"
      aria-label={t("langGroup")}
      className={cn(
        "inline-flex items-center rounded-full border border-[rgba(33,34,38,0.1)] bg-white text-[11.5px] font-[450] overflow-hidden shrink-0",
        compact ? "h-8" : "h-8",
      )}
    >
      <button
        type="button"
        onClick={() => setLocale("vi")}
        className={cn(
          "px-2.5 h-full",
          locale === "vi" ? "bg-[#121317] text-white" : "text-[#45474D] hover:bg-[#F8F9FA]",
        )}
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "px-2.5 h-full",
          locale === "en" ? "bg-[#121317] text-white" : "text-[#45474D] hover:bg-[#F8F9FA]",
        )}
      >
        EN
      </button>
    </div>
  );
}
