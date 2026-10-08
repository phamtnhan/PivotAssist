"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { useRealtime } from "@/lib/useRealtime";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const { user, isLoading } = useUser();
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const response = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setLoadError(apiErrorText(payload, locale, t("notifLoadFail")));
      setLoaded(true);
      return;
    }
    setItems(payload.notifications ?? []);
    setUnreadCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
    setLoadError(null);
    setLoaded(true);
  }

  useEffect(() => {
    if (isLoading || !user) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  useRealtime((event) => {
    if (event.type === "notification" || event.type === "support") void refresh();
  });

  if (isLoading || !user) return null;

  const markRead = async (id?: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { markAllRead: true }),
    }).catch(() => null);
    await refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void refresh();
        }}
        aria-label={t("notifications")}
        className="relative w-8 h-8 rounded-full flex items-center justify-center text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04] transition-colors"
      >
        <Bell size={18} weight={unreadCount > 0 ? "fill" : "regular"} />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#C5221F] text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-[320px] max-h-[420px] overflow-auto rounded-2xl border border-[rgba(33,34,38,0.12)] bg-white shadow-lg z-50">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[rgba(33,34,38,0.06)]">
            <strong className="text-[12.5px] text-[#121317]">{t("notifications")}</strong>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markRead()}
                className="text-[11px] font-bold text-[#1A73E8]"
              >
                {t("markRead")}
              </button>
            ) : null}
          </div>
          {loadError ? <p className="px-3.5 py-3 text-[12px] text-[#C5221F]">{loadError}</p> : null}
          {!loaded ? (
            <p className="px-3.5 py-6 text-[12.5px] text-[#5F6368] text-center">
              {t("loadingNotifications")}
            </p>
          ) : items.length === 0 && !loadError ? (
            <p className="px-3.5 py-6 text-[12.5px] text-[#5F6368] text-center">
              {t("noNotificationsHint")}
            </p>
          ) : (
            <ul className="divide-y divide-[rgba(33,34,38,0.06)]">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href || "/applications"}
                    onClick={() => {
                      if (!item.readAt) void markRead(item.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "block px-3.5 py-3 hover:bg-[#F8F9FA]",
                      !item.readAt && "bg-[#E8F0FE]/50",
                    )}
                  >
                    <div className="text-[12.5px] font-bold text-[#121317]">{item.title}</div>
                    <p className="text-[12px] text-[#45474D] mt-0.5 leading-relaxed">{item.body}</p>
                    <div className="text-[10px] font-mono text-[#5F6368] mt-1">
                      {new Date(item.createdAt).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
