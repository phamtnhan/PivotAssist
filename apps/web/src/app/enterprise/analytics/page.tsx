"use client";

import { useEffect, useState } from "react";
import { EnterpriseAppShell } from "@/components/EnterpriseAppShell";
import { cn } from "@/lib/utils";
import {
  ChartBar,
  Sparkle,
  TrendUp,
  Clock,
  Users,
  CheckCircle,
  Brain,
} from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";
import { enterpriseAnalyticsCopy, fillCopy } from "@/lib/i18n-enterprise";

export default function EnterpriseAnalyticsPage() {
  const { locale } = useLocale();
  const copy = enterpriseAnalyticsCopy(locale);
  const [liveFunnel, setLiveFunnel] = useState<
    Array<{ stage: string; count: number; pct: string; color: string }>
  >([]);
  const [liveMetrics, setLiveMetrics] = useState<{
    applications: number;
    completed: number;
    shortlisted: number;
    scheduled: number;
    hired: number;
    interviews: number;
    averageScore: number;
  } | null>(null);
  const [skillGaps, setSkillGaps] = useState<
    Array<{ skill: string; passRate: number; gap: string }>
  >([]);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadAnalytics() {
      const response = await fetch("/api/enterprise/analytics", { cache: "no-store" }).catch(
        () => null,
      );
      const payload = await response?.json().catch(() => null);
      if (cancelled) return;
      if (!response?.ok || !payload?.success) {
        setAnalyticsError(copy.loadFail);
        return;
      }
      const stageLabel = (stage: string) => {
        if (stage === "received") return copy.stageReceived;
        if (stage === "ai") return copy.stageAi;
        if (stage === "selected") return copy.stageSelected;
        if (stage === "room") return copy.stageRoom;
        if (stage === "hired") return copy.stageHired;
        return stage;
      };
      setLiveMetrics(payload.metrics);
      const total = payload.metrics.applications || 1;
      setLiveFunnel(
        (payload.funnel ?? []).map((item: { stage: string; count: number }, index: number) => ({
          stage: stageLabel(item.stage),
          count: item.count,
          pct: `${Math.round((item.count / total) * 1000) / 10}%`,
          color:
            ["bg-ink", "bg-accent-deep", "bg-blue-600", "bg-amber-600", "bg-emerald-600"][index] ??
            "bg-ink",
        })),
      );
      const maxCount = Math.max(
        1,
        ...(payload.skillGaps ?? []).map(
          (item: { count?: number; gapCount?: number }) => item.gapCount ?? item.count ?? 0,
        ),
      );
      setSkillGaps(
        (payload.skillGaps ?? []).map(
          (item: { skill: string; count?: number; gapCount?: number }) => {
            const n = item.gapCount ?? item.count ?? 0;
            return {
              skill: item.skill,
              passRate: Math.round((n / maxCount) * 100),
              gap: fillCopy(copy.skillGap, { n }),
            };
          },
        ),
      );
    }
    void loadAnalytics();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy.loadFail]);
  const funnelData = liveFunnel;

  return (
    <EnterpriseAppShell>
      <div className="max-w-[1200px] mx-auto animate-in fade-in duration-300 space-y-8 pb-20">
        {/* Header */}
        <div className="border-b border-mist pb-5">
          <div className="flex items-center gap-2 text-[12px] font-bold text-accent-deep uppercase tracking-wider mb-1">
            <Sparkle size={14} weight="fill" />
            <span>{copy.eyebrow}</span>
          </div>
          <h1 className="text-[24px] font-bold text-ink tracking-tight">{copy.title}</h1>
          <p className="text-[13.5px] text-ink-soft mt-1">{copy.lead}</p>
          {analyticsError && (
            <p className="text-[12.5px] text-red-600 mt-2" role="alert">
              {analyticsError}
            </p>
          )}
        </div>

        {/* Top ROI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-mist rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-[12px] font-bold text-ink-soft uppercase tracking-wider mb-1">
              <Clock size={16} className="text-accent-deep" />
              {copy.avgScore}
            </div>
            <div className="text-[26px] font-bold text-ink">
              {liveMetrics ? `${liveMetrics.averageScore}/100` : "—"}
            </div>
            <div className="text-[11.5px] text-emerald-700 font-semibold mt-1">
              {copy.avgScoreHint}
            </div>
          </div>

          <div className="bg-white border border-mist rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-[12px] font-bold text-ink-soft uppercase tracking-wider mb-1">
              <Brain size={16} className="text-accent-deep" />
              {copy.sessions}
            </div>
            <div className="text-[26px] font-bold text-accent-deep">
              {liveMetrics?.interviews ?? "—"}
            </div>
            <div className="text-[11.5px] text-accent-deep font-semibold mt-1">
              {copy.sessionsHint}
            </div>
          </div>

          <div className="bg-white border border-mist rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-[12px] font-bold text-ink-soft uppercase tracking-wider mb-1">
              <Users size={16} className="text-accent-deep" />
              {copy.complete}
            </div>
            <div className="text-[26px] font-bold text-ink">
              {liveMetrics
                ? `${Math.round((liveMetrics.completed / Math.max(1, liveMetrics.applications)) * 1000) / 10}%`
                : "—"}
            </div>
            <div className="text-[11.5px] text-emerald-700 font-semibold mt-1">
              {copy.completeHint}
            </div>
          </div>

          <div className="bg-white border border-mist rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2 text-[12px] font-bold text-ink-soft uppercase tracking-wider mb-1">
              <CheckCircle size={16} className="text-emerald-600" />
              {copy.hired}
            </div>
            <div className="text-[26px] font-bold text-emerald-700">
              {liveMetrics?.hired ?? "—"} {copy.hiredUnit}
            </div>
            <div className="text-[11.5px] text-emerald-700 font-semibold mt-1">
              {copy.hiredHint}
            </div>
          </div>
        </div>

        {/* Funnel Conversion Breakdown */}
        <div className="bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
          <div className="border-b border-mist pb-4">
            <h3 className="font-bold text-[16px] text-ink">{copy.funnelTitle}</h3>
            <p className="text-[12.5px] text-ink-soft mt-0.5">{copy.funnelLead}</p>
          </div>

          <div className="space-y-4">
            {funnelData.length === 0 ? (
              <p className="text-[13px] text-ink-soft">{copy.empty}</p>
            ) : (
              funnelData.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px] font-semibold text-ink">
                    <span>{item.stage}</span>
                    <span className="font-mono text-ink-soft">
                      {item.count} {copy.people} ({item.pct})
                    </span>
                  </div>
                  <div className="h-3 w-full bg-paper rounded-full overflow-hidden border border-mist">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", item.color)}
                      style={{ width: item.pct }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Skill Gap Analysis */}
        <div className="bg-white border border-mist rounded-2xl p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
          <div className="border-b border-mist pb-4">
            <h3 className="font-bold text-[16px] text-ink">{copy.skillTitle}</h3>
            <p className="text-[12.5px] text-ink-soft mt-0.5">{copy.skillLead}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skillGaps.length === 0 ? (
              <p className="text-[13px] text-ink-soft col-span-2">{copy.skillEmpty}</p>
            ) : (
              skillGaps.map((sg, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-mist bg-paper/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[13.5px] text-ink">{sg.skill}</span>
                    <span className="text-[12px] font-bold text-accent-deep bg-accent-deep/10 px-2 py-0.5 rounded">
                      {sg.passRate}% {copy.pass}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-soft leading-relaxed">⚠️ {sg.gap}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </EnterpriseAppShell>
  );
}
