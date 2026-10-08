"use client";

import { useEffect, useRef, useState } from "react";
import { AdminAppShell } from "@/components/AdminAppShell";
import { useRealtime } from "@/lib/useRealtime";
import { useLocale } from "@/lib/i18n";

type ChatItem = { id: string; sender: string; body: string; createdAt: string };

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  classification: string;
  createdAt: string;
  user?: { fullName?: string; email?: string; role?: string } | null;
  messages?: ChatItem[];
};

function ticketStatusLabel(
  status: string,
  t: (key: "adminTicketOpen" | "adminTicketProgress" | "adminTicketResolved") => string,
) {
  if (status === "IN_PROGRESS") return t("adminTicketProgress");
  if (status === "RESOLVED" || status === "CLOSED") return t("adminTicketResolved");
  return t("adminTicketOpen");
}

export default function AdminSupportPage() {
  const { t } = useLocale();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<"all" | "USER" | "ENTERPRISE">("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadInflight = useRef<Promise<void> | null>(null);

  function load() {
    if (loadInflight.current) return loadInflight.current;
    const run = (async () => {
      const query = filter === "all" ? "" : `?classification=${filter}`;
      const response = await fetch(`/api/admin/support${query}`, { cache: "no-store" }).catch(
        () => null,
      );
      const payload = await response?.json().catch(() => null);
      if (!response?.ok || !payload?.success) {
        setErrorMessage(payload?.error ?? "Không thể tải hộp thư hỗ trợ.");
      } else {
        setErrorMessage(null);
        setTickets(payload.tickets ?? []);
      }
      setLoaded(true);
    })().finally(() => {
      loadInflight.current = null;
    });
    loadInflight.current = run;
    return run;
  }

  useEffect(() => {
    setLoaded(false);
    setTickets([]);
    void load();
    // load is stable enough; filter is the refresh key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load();
    }, 12_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useRealtime((event) => {
    if (event.type === "support") void load();
  });

  const update = async (
    id: string,
    patch: { status?: string; classification?: string; reply?: string },
  ) => {
    if (patch.reply) setSendingId(id);
    const response = await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setErrorMessage(payload?.error ?? "Không thể cập nhật hộp thư hỗ trợ.");
      if (patch.reply) setSendingId(null);
      return;
    }
    setErrorMessage(null);
    if (patch.reply) setDrafts((current) => ({ ...current, [id]: "" }));
    if (patch.reply) setSendingId(null);
    await load();
  };

  return (
    <AdminAppShell>
      <div className="max-w-[1240px] mx-auto space-y-6 pb-16">
        <div>
          <h1 className="text-2xl font-[450] text-[#121317]">{t("adminSupport")}</h1>
          <p className="text-[13.5px] text-[#45474D] mt-1">{t("adminSupportLead")}</p>
        </div>
        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[13px] text-[#C5221F]"
          >
            {errorMessage}
          </div>
        )}
        <div className="flex gap-2">
          {[
            { id: "all", label: t("adminFilterAll") },
            { id: "USER", label: t("adminFilterUser") },
            { id: "ENTERPRISE", label: t("adminFilterEnt") },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id as typeof filter)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-[450] ${filter === item.id ? "bg-[#121317] text-white" : "bg-white border border-[rgba(33,34,38,0.08)]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {!loaded ? (
            <p className="text-[13px] text-[#45474D]">{t("adminLoadingTickets")}</p>
          ) : null}
          {loaded && tickets.length === 0 ? (
            <p className="text-[13px] text-[#45474D]">{t("adminEmptyTickets")}</p>
          ) : null}
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[20px] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[15px] text-[#121317]">{ticket.subject}</strong>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${ticket.classification === "ENTERPRISE" ? "bg-[#E8F0FE] text-[#1A73E8]" : "bg-[#E6F4EA] text-[#137333]"}`}
                >
                  {ticket.classification === "ENTERPRISE"
                    ? t("adminFilterEnt")
                    : t("adminFilterUser")}
                </span>
              </div>
              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto rounded-2xl bg-[#F8F9FA] p-3">
                {(ticket.messages?.length
                  ? ticket.messages
                  : [
                      {
                        id: "seed",
                        sender: "USER",
                        body: ticket.message,
                        createdAt: ticket.createdAt,
                      },
                    ]
                ).map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-[13px] ${item.sender === "STAFF" ? "bg-[#1A73E8] text-white ml-auto" : "bg-white border border-[rgba(33,34,38,0.08)]"}`}
                  >
                    {item.body}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[12px] text-[#5F6368]">
                {ticket.user?.fullName ?? t("adminAccount")} · {ticket.user?.email ?? "—"} ·{" "}
                {new Date(ticket.createdAt).toLocaleString()} ·{" "}
                {ticketStatusLabel(ticket.status, t)}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reply = (drafts[ticket.id] ?? "").trim();
                  if (!reply) return;
                  void update(ticket.id, { reply });
                }}
              >
                <input
                  value={drafts[ticket.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))
                  }
                  placeholder={t("adminReplyPh")}
                  className="flex-1 rounded-full border border-[rgba(33,34,38,0.1)] px-3.5 py-2 text-[13px]"
                />
                <button
                  type="submit"
                  disabled={sendingId === ticket.id}
                  className="rounded-full bg-[#1A73E8] text-white px-4 py-2 text-[12.5px] font-[450] disabled:opacity-50"
                >
                  {t("supportSend")}
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void update(ticket.id, { classification: "USER" })}
                  className="text-[12px] px-3 py-1 rounded-full border"
                >
                  {t("adminTagUser")}
                </button>
                <button
                  type="button"
                  onClick={() => void update(ticket.id, { classification: "ENTERPRISE" })}
                  className="text-[12px] px-3 py-1 rounded-full border"
                >
                  {t("adminTagEnt")}
                </button>
                <button
                  type="button"
                  onClick={() => void update(ticket.id, { status: "IN_PROGRESS" })}
                  className="text-[12px] px-3 py-1 rounded-full border"
                >
                  {t("adminInProgress")}
                </button>
                <button
                  type="button"
                  onClick={() => void update(ticket.id, { status: "RESOLVED" })}
                  className="text-[12px] px-3 py-1 rounded-full border"
                >
                  {t("adminDone")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AdminAppShell>
  );
}
