"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChatCircle, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { useUser } from "@/lib/useUser";
import { SUPPORT_CHAT_EVENT } from "@/lib/support-chat";
import { useRealtime } from "@/lib/useRealtime";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";

type ChatItem = { id: string; sender: string; body: string; createdAt: string };

export function SupportChatWidget() {
  const pathname = usePathname();
  const { user, isLoading } = useUser();
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const hidden =
    pathname.startsWith("/admin") ||
    pathname === "/interview/room" ||
    (pathname.startsWith("/face-to-face/") && pathname !== "/face-to-face");

  async function refresh() {
    const response = await fetch("/api/support/chat", { cache: "no-store" }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (payload?.success) setItems(payload.messages ?? []);
  }

  useEffect(() => {
    const onOpen = (event: Event) => {
      const draftText = (event as CustomEvent<{ draft?: string }>).detail?.draft;
      if (typeof draftText === "string" && draftText.trim()) setDraft(draftText.trim());
      setOpen(true);
    };
    window.addEventListener(SUPPORT_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(SUPPORT_CHAT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    void refresh();
  }, [open, user]);

  useRealtime((event) => {
    if (event.type === "support" && (open || user)) void refresh();
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, open]);

  if (hidden) return null;

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (!user) {
      setNotice(t("supportNeedLogin"));
      return;
    }
    setSending(true);
    setNotice(null);
    const response = await fetch("/api/support/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    setSending(false);
    if (!response?.ok || !payload?.success) {
      setNotice(apiErrorText(payload, locale, t("supportSendFail")));
      return;
    }
    setDraft("");
    setItems(payload.messages ?? []);
  };

  return (
    <div
      className="fixed right-4 z-[60] md:right-6"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      {open ? (
        <div className="mb-3 w-[min(360px,calc(100vw-2rem))] h-[min(460px,70vh)] rounded-[22px] bg-white shadow-xl border border-[rgba(33,34,38,0.12)] flex flex-col overflow-hidden mb-20 md:mb-3">
          <div className="px-4 py-3 bg-[#121317] text-white flex items-center justify-between">
            <div>
              <div className="text-[14px] font-[450]">{t("supportTitle")}</div>
              <div className="text-[11px] text-white/70">{t("supportLead")}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("supportClose")}
              className="w-8 h-8 rounded-full hover:bg-white/10"
            >
              <X size={16} className="mx-auto" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[#F0F2F5]">
            {items.length === 0 ? (
              <p className="text-[12.5px] text-[#5F6368] text-center mt-8">
                {isLoading ? t("supportLoading") : user ? t("supportEmpty") : t("supportLoginHint")}
              </p>
            ) : null}
            {items.map((item) => (
              <div
                key={item.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${item.sender === "STAFF" ? "bg-white text-[#121317]" : "bg-[#1A73E8] text-white ml-auto"}`}
              >
                {item.body}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {notice ? <p className="px-3 py-1.5 text-[12px] text-[#C5221F]">{notice}</p> : null}
          {!user && !isLoading ? (
            <Link
              href="/login"
              className="m-3 text-center rounded-full bg-[#121317] text-white py-2 text-[13px] font-[450]"
            >
              {t("supportLoginCta")}
            </Link>
          ) : (
            <form
              className="p-2.5 border-t border-[rgba(33,34,38,0.08)] flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("supportPlaceholder")}
                className="flex-1 rounded-full bg-[#F8F9FA] px-3.5 py-2 text-[13px] outline-none"
              />
              <button
                type="submit"
                disabled={sending}
                aria-label={t("supportSend")}
                className="w-10 h-10 rounded-full bg-[#1A73E8] text-white flex items-center justify-center disabled:opacity-50"
              >
                <PaperPlaneTilt size={16} weight="fill" />
              </button>
            </form>
          )}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={t("supportOpen")}
        className="w-14 h-14 rounded-full bg-[#1A73E8] text-white shadow-lg flex items-center justify-center hover:bg-[#1558B0] mb-16 md:mb-0"
      >
        {open ? <X size={24} weight="bold" /> : <ChatCircle size={26} weight="fill" />}
      </button>
    </div>
  );
}
