"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

const STORAGE_KEY = "pivotassist:media-consent";

export type MediaConsentKind = "mic" | "camera-mic";

export function hasMediaConsent(kind: MediaConsentKind) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<MediaConsentKind, boolean>>) : {};
    return Boolean(parsed[kind]);
  } catch {
    return false;
  }
}

export function rememberMediaConsent(kind: MediaConsentKind) {
  const current = hasMediaConsent(kind) ? { [kind]: true } : {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...parsed, ...current, [kind]: true }),
    );
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ [kind]: true }));
  }
}

export function MediaConsentDialog({
  kind,
  open,
  onAccept,
  onCancel,
}: {
  kind: MediaConsentKind;
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-xl">
        <h2 className="text-[18px] font-[450] text-[#121317]">
          {kind === "mic" ? t("consentMicTitle") : t("consentCamTitle")}
        </h2>
        <p className="mt-2 text-[13.5px] text-[#45474D] leading-relaxed">
          {kind === "mic" ? t("consentMicLead") : t("consentCamLead")}
        </p>
        <label className="mt-4 flex items-start gap-2 text-[13px] text-[#121317]">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-0.5"
          />
          <span>{t("consentCheck")}</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-[13px] text-[#45474D] hover:bg-[#F8F9FA]"
          >
            {t("consentLater")}
          </button>
          <button
            type="button"
            disabled={!checked}
            onClick={() => {
              rememberMediaConsent(kind);
              onAccept();
            }}
            className="px-4 py-2 rounded-full text-[13px] font-[450] bg-[#121317] text-white disabled:opacity-40"
          >
            {t("consentOk")}
          </button>
        </div>
      </div>
    </div>
  );
}
