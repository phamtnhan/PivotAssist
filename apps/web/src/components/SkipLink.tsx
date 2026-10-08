"use client";

import { useLocale } from "@/lib/i18n";

export function SkipLink() {
  const { t } = useLocale();
  return (
    <a href="#main-content" className="skip-link">
      {t("skipLink")}
    </a>
  );
}
