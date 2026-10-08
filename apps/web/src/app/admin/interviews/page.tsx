"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminAppShell } from "@/components/AdminAppShell";
import {
  Cpu,
  MagnifyingGlass,
  CheckCircle,
  ArrowRight,
  Clock,
  Sparkle,
  VideoCamera,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";
import { adminInterviewsCopy } from "@/lib/i18n-admin";
import { fillCopy } from "@/lib/i18n-enterprise";
import { apiErrorText } from "@/lib/api-errors";
import { useRealtime } from "@/lib/useRealtime";

interface InterviewAuditRow {
  id: string;
  roomCode: string;
  candidateName: string;
  targetRole: string;
  sourceType: "ent" | "personal";
  companyName?: string;
  score: number;
  starScore: number;
  duration: string;
  timestamp: string;
  status: "scored" | "in_progress";
  modelName: string;
}

export default function AdminInterviewsPage() {
  const { locale } = useLocale();
  const copy = adminInterviewsCopy(locale);
  const [audits, setAudits] = useState<InterviewAuditRow[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInterviews, setTotalInterviews] = useState(0);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "pipeline" || event.type === "notification")
      setLiveTick((current) => current + 1);
  });

  useEffect(() => {
    let cancelled = false;
    async function loadInterviews() {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/admin/interviews?${params.toString()}`, {
        cache: "no-store",
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (cancelled || !response?.ok || !payload?.success) {
        if (!cancelled) setLoadError(apiErrorText(payload, locale, copy.loadFail));
        return;
      }
      setLoadError(null);
      setAudits(
        (payload.interviews ?? []).map(
          (item: {
            id: string;
            targetRole: string;
            createdAt: string;
            durationSeconds: number;
            user?: { fullName?: string };
            job?: { title?: string; company?: { name?: string } | null } | null;
            interviewScore?: {
              overallScore?: number;
              starOverallScore?: number;
              evaluationStatus?: string;
              modelName?: string;
            } | null;
          }) => ({
            id: item.id,
            roomCode: `#${item.id.slice(0, 10).toUpperCase()}`,
            candidateName: item.user?.fullName ?? copy.person,
            targetRole: item.job?.title ?? item.targetRole,
            sourceType: item.job ? "ent" : "personal",
            companyName: item.job?.company?.name,
            score: item.interviewScore?.overallScore ?? 0,
            starScore: item.interviewScore?.starOverallScore ?? 0,
            duration: fillCopy(copy.mins, { n: Math.floor((item.durationSeconds ?? 0) / 60) }),
            timestamp: new Date(item.createdAt).toLocaleString(locale === "en" ? "en-GB" : "vi-VN"),
            status: item.interviewScore?.evaluationStatus === "READY" ? "scored" : "in_progress",
            modelName: item.interviewScore?.modelName ?? "—",
          }),
        ),
      );
      const nextTotalPages = Math.max(1, Number(payload.totalPages ?? 1));
      setTotalPages(nextTotalPages);
      setTotalInterviews(Number(payload.total ?? 0));
      if (page > nextTotalPages) setPage(nextTotalPages);
      setLiveMode(true);
    }
    void loadInterviews();
    return () => {
      cancelled = true;
    };
  }, [locale, copy.loadFail, copy.person, copy.mins, liveTick, page, search]);

  const filteredAudits = audits.filter((a) => {
    const matchesSearch =
      a.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      a.roomCode.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || a.sourceType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <AdminAppShell>
      <div className="max-w-[1240px] mx-auto font-sans space-y-6 pb-20">
        {/* Header */}
        <div className="border-b border-[rgba(33,34,38,0.06)] pb-5">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#1A73E8] uppercase tracking-wider mb-1">
            <VideoCamera size={14} weight="fill" />
            <span>{copy.eyebrow}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-sans font-[450] text-[#121317] tracking-[-0.02em]">
            {copy.title}
          </h1>
          <p className="text-[13.5px] text-[#45474D] mt-1 font-normal">{copy.lead}</p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex flex-1 flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-md">
              <MagnifyingGlass
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={copy.search}
                className="w-full bg-[#F8F9FA] focus:bg-white border border-[rgba(33,34,38,0.12)] rounded-full pl-9 pr-4 py-2 text-[13px] text-[#121317] placeholder:text-[#45474D] focus:outline-none focus:border-[#1A73E8] transition-all"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.12)] rounded-full px-4 py-2 text-[12.5px] text-[#121317] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
            >
              <option value="all">{copy.all}</option>
              <option value="ent">{copy.ent}</option>
              <option value="personal">{copy.personal}</option>
            </select>
          </div>

          <div className="text-[12.5px] text-[#45474D] font-[450] shrink-0">
            {liveMode ? copy.live : copy.unloaded} ·{" "}
            {filteredAudits.filter((row) => row.status === "scored").length}/{totalInterviews}{" "}
            {copy.scored}
          </div>
        </div>

        {/* Table in Antigravity Card */}
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-[#F8F9FA]/80 border-b border-[rgba(33,34,38,0.06)] text-[#45474D] text-[11px] font-mono uppercase tracking-wider">
                  <th className="py-3.5 px-6">{copy.colRoom}</th>
                  <th className="py-3.5 px-4">{copy.colPerson}</th>
                  <th className="py-3.5 px-4">{copy.colChannel}</th>
                  <th className="py-3.5 px-4">{copy.colScore}</th>
                  <th className="py-3.5 px-4">{copy.colDur}</th>
                  <th className="py-3.5 px-6 text-right">{copy.colDetail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(33,34,38,0.06)]">
                {loadError ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-[#C5221F]">
                      {loadError}
                    </td>
                  </tr>
                ) : filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-[#45474D]">
                      {copy.empty}
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F8F9FA]/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-mono font-medium text-[#1A73E8] text-[13px]">
                          {a.roomCode}
                        </div>
                        <div className="text-[11.5px] text-[#45474D] font-normal">
                          {a.timestamp}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-[450] text-[14px] text-[#121317]">
                          {a.candidateName}
                        </div>
                        <div className="text-[12px] text-[#45474D] font-normal">{a.targetRole}</div>
                      </td>

                      <td className="py-4 px-4">
                        <div>
                          <span
                            className={cn(
                              "text-[11px] font-[450] px-2.5 py-0.5 rounded-full border inline-block",
                              a.sourceType === "ent"
                                ? "bg-[#F3E8FD] text-[#6E2594] border-[#E9D5FF]"
                                : "bg-[#F8F9FA] text-[#45474D] border-[rgba(33,34,38,0.1)]",
                            )}
                          >
                            {a.sourceType === "ent" ? copy.ent : copy.personal}
                          </span>
                          {a.companyName && (
                            <div className="text-[11.5px] text-[#121317] font-medium mt-1">
                              {a.companyName}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium text-[#121317] text-[13.5px]">
                            {a.score}/100
                          </span>
                          <span className="text-[11px] text-[#137333] font-[450] bg-[#E6F4EA] px-2 py-0.5 rounded-full border border-[#CEEAD6]">
                            {fillCopy(copy.situation, { n: a.starScore })}
                          </span>
                          <div className="text-[10.5px] text-[#5F6368] mt-1">
                            {a.modelName.startsWith("gemini") ? copy.engineCloud : copy.engineLocal}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-[#45474D] font-mono text-[12px]">
                        {a.duration}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/interview/report/${encodeURIComponent(a.id)}`}
                          className="inline-flex items-center gap-1.5 bg-[#F8F9FA] hover:bg-[#121317] hover:text-white text-[#121317] border border-[rgba(33,34,38,0.12)] px-3 py-1 rounded-full text-[12px] font-[450] transition-all shadow-2xs"
                        >
                          <span>{copy.report}</span>
                          <ArrowRight size={12} weight="bold" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-[12.5px] text-[#45474D]">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[rgba(33,34,38,0.12)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F8F9FA]"
            >
              {copy.previous}
            </button>
            <span>{fillCopy(copy.pageOf, { page, pages: totalPages })}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-full border border-[rgba(33,34,38,0.12)] px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#F8F9FA]"
            >
              {copy.next}
            </button>
          </div>
        )}
      </div>
    </AdminAppShell>
  );
}
