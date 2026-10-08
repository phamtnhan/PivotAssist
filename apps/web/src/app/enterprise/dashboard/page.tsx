"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CalendarBlank,
  ChartBar,
  CheckCircle,
  Clock,
  FileText,
  Funnel,
  MagnifyingGlass,
  PlusCircle,
  Sparkle,
  Star,
  Users,
} from "@phosphor-icons/react";
import { EnterpriseAppShell } from "@/components/EnterpriseAppShell";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { type EnterpriseApplication, type EnterpriseJob } from "@/data/enterprise-data";
import { applicationStatusLabel, employmentTypeLabel, locationLabel } from "@/lib/ui-copy";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import {
  enterpriseDashCopy,
  enterpriseDateLabel,
  enterpriseJobStatusLabel,
  enterpriseNextActionLabel,
  enterprisePayLabel,
  enterpriseRoleFallback,
  fillCopy,
} from "@/lib/i18n-enterprise";
import { useRealtime } from "@/lib/useRealtime";

type StageFilter =
  | "ALL"
  | "AI_INTERVIEW_PENDING"
  | "AI_INTERVIEW_COMPLETED"
  | "SHORTLISTED"
  | "FACE_TO_FACE_SCHEDULED";

const STAGE_FILTER_IDS: StageFilter[] = [
  "ALL",
  "AI_INTERVIEW_PENDING",
  "AI_INTERVIEW_COMPLETED",
  "SHORTLISTED",
  "FACE_TO_FACE_SCHEDULED",
];

const STATUS_TONE: Record<string, string> = {
  AI_INTERVIEW_PENDING: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  AI_INTERVIEW_COMPLETED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  HOLD: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  ADDITIONAL_ASSESSMENT: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  OFFER_PENDING: "bg-[#E8F0FE] text-[#185ABC] border-[#D2E3FC]",
  SHORTLISTED: "bg-[#E8F0FE] text-[#185ABC] border-[#D2E3FC]",
  HIRED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  REJECTED: "bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]",
  FACE_TO_FACE_SCHEDULED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
};

function isScored(application: EnterpriseApplication) {
  return Boolean(application.interviewId && application.completedAt);
}

function stageCount(applications: EnterpriseApplication[], status: StageFilter) {
  if (status === "ALL") return applications.length;
  return applications.filter((application) => application.status === status).length;
}

type EnterpriseJobView = EnterpriseJob & {
  companyName?: string;
  applications?: EnterpriseApplication[];
};

export default function EnterpriseDashboardPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { t, locale } = useLocale();
  const copy = enterpriseDashCopy(locale);
  const [jobs, setJobs] = useState<EnterpriseJobView[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [applications, setApplications] = useState<EnterpriseApplication[]>([]);
  const [dataSource, setDataSource] = useState<"empty" | "live" | "loading" | "error">("loading");
  const [isLoadingLiveData, setIsLoadingLiveData] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
  const [notice, setNotice] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "pipeline" || event.type === "jobs" || event.type === "notification") {
      setLiveTick((current) => current + 1);
    }
  });

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || !["RECRUITER", "ADMIN"].includes(user.role)) {
      setIsLoadingLiveData(false);
      setJobs([]);
      setApplications([]);
      setDataSource("empty");
      return;
    }
    let cancelled = false;

    async function loadLiveWorkspace() {
      if (dataSource !== "live") setIsLoadingLiveData(true);
      try {
        const response = await fetch("/api/enterprise/jobs", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(apiErrorText(payload, locale, copy.loadFail));
        if (cancelled) return;
        const liveJobs = (payload.jobs ?? []) as EnterpriseJobView[];
        setJobs(liveJobs);
        setApplications(liveJobs.flatMap((job) => job.applications ?? []));
        setSelectedJobId((current) => {
          if (current && liveJobs.some((job) => job.id === current)) return current;
          return (
            liveJobs.find((job) => (job.applications ?? []).length > 0)?.id ?? liveJobs[0]?.id ?? ""
          );
        });
        setDataSource("live");
      } catch {
        if (!cancelled) {
          setJobs([]);
          setApplications([]);
          setDataSource("error");
          setNotice(copy.hireFail);
        }
      } finally {
        if (!cancelled) setIsLoadingLiveData(false);
      }
    }

    void loadLiveWorkspace();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoading, user, liveTick]);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const jobApplications = useMemo(
    () => applications.filter((application) => application.jobId === selectedJobId),
    [applications, selectedJobId],
  );
  const filteredApplications = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return jobApplications.filter((application) => {
      const matchesSearch =
        !normalizedQuery ||
        `${application.candidateName} ${application.candidateRole}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStage = stageFilter === "ALL" || application.status === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [jobApplications, searchQuery, stageFilter]);

  const rankedApplications = useMemo(
    () =>
      filteredApplications
        .filter(isScored)
        .sort((a, b) => (b.interviewScore ?? -1) - (a.interviewScore ?? -1)),
    [filteredApplications],
  );
  const waitingApplications = filteredApplications.filter((application) => !isScored(application));
  const completedCount = jobApplications.filter(isScored).length;
  const shortlistedCount = jobApplications.filter((application) =>
    ["SHORTLISTED", "FACE_TO_FACE_SCHEDULED", "HIRED"].includes(application.status),
  ).length;

  const advanceApplication = async (application: EnterpriseApplication) => {
    if (application.status !== "AI_INTERVIEW_COMPLETED") {
      setNotice(copy.makeRoom);
      return;
    }
    try {
      if (dataSource !== "live") {
        setNotice(copy.needSync);
        return;
      }
      const response = await fetch(
        `/api/enterprise/applications/${encodeURIComponent(application.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SHORTLISTED" }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, copy.updateFail));
      const updatedApplication = payload.application as EnterpriseApplication;
      setApplications((current) =>
        current.map((item) => (item.id === application.id ? updatedApplication : item)),
      );
      setNotice(
        fillCopy(copy.shortlistedFor, {
          name: application.candidateName,
          title: selectedJob?.title ?? copy.thisRole,
        }),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.updateFail);
    }
  };

  if (isLoadingLiveData && jobs.length === 0) {
    return (
      <EnterpriseAppShell>
        <div className="max-w-[900px] mx-auto py-16 text-center">
          <div className="bg-white border border-mist rounded-2xl p-10 shadow-2xs">
            <h1 className="text-xl font-bold text-ink">{copy.syncing}</h1>
            <p className="text-[13px] text-ink-soft mt-2">{copy.live}</p>
          </div>
        </div>
      </EnterpriseAppShell>
    );
  }

  if (!selectedJob) {
    return (
      <EnterpriseAppShell>
        <div className="max-w-[900px] mx-auto py-16 text-center">
          <div className="bg-white border border-mist rounded-2xl p-10 shadow-2xs">
            <Briefcase size={28} className="mx-auto text-accent-deep" />
            <h1 className="text-xl font-bold text-ink mt-4">{copy.emptyJobs}</h1>
            <p className="text-[13px] text-ink-soft mt-2">{copy.rankEmptyLead}</p>
            <Link
              href="/enterprise/jobs/create"
              className="inline-flex items-center gap-2 mt-5 bg-accent-deep text-white px-4 py-2.5 rounded-full text-[12.5px] font-bold"
            >
              {t("entCreateJob")} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </EnterpriseAppShell>
    );
  }

  return (
    <EnterpriseAppShell>
      <div className="max-w-[1400px] mx-auto animate-in fade-in duration-300 space-y-6 pb-20">
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-accent-deep uppercase tracking-[0.14em] mb-2">
              <Sparkle size={14} weight="fill" /> {copy.space}
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-[450] text-ink tracking-[-0.03em] text-balance">
              {t("entDashTitle")}
            </h1>
            <p className="text-[13.5px] text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
              {t("entDashLead")}
            </p>
            <div className="inline-flex items-center gap-2 mt-3 text-[10.5px] font-mono text-ink-soft">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  dataSource === "live" ? "bg-[#34A853]" : "bg-[#F9AB00]",
                )}
              />
              {isLoadingLiveData
                ? copy.syncing
                : dataSource === "live"
                  ? copy.live
                  : dataSource === "error"
                    ? copy.err
                    : copy.emptyJobs}
            </div>
          </div>
          <Link
            href="/enterprise/jobs/create"
            className="inline-flex items-center justify-center gap-2 bg-accent-deep hover:bg-accent-hover text-white px-4 py-2.5 rounded-xl font-bold text-[12.5px] shadow-xs transition-all"
          >
            <PlusCircle size={16} weight="bold" /> {t("entCreateJob")}
          </Link>
        </header>

        {notice && (
          <div
            className="flex items-start justify-between gap-4 rounded-2xl border border-[#CEEAD6] bg-[#E6F4EA] px-4 py-3 text-[12.5px] text-[#137333]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-[#137333] hover:text-[#0D652D] font-bold"
              aria-label={copy.close}
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
          <aside className="bg-white border border-mist rounded-2xl p-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)] xl:sticky xl:top-24 min-w-0">
            <div className="flex items-center justify-between px-2 py-1.5 mb-2">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-soft">
                  {copy.roles}
                </div>
                <div className="text-[13px] font-bold text-ink mt-0.5">{copy.hiring}</div>
              </div>
              <span className="font-mono text-[11px] text-ink-soft">{jobs.length}</span>
            </div>
            <div
              className="flex xl:flex-col gap-2 overflow-x-auto no-scrollbar xl:overflow-visible"
              role="listbox"
              aria-label={copy.pickRole}
            >
              {jobs.map((job) => {
                const selected = job.id === selectedJobId;
                const jobApps = applications.filter((application) => application.jobId === job.id);
                const count = jobApps.length;
                const scored = jobApps.filter(isScored).length;
                return (
                  <button
                    key={job.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setStageFilter("ALL");
                      setSearchQuery("");
                      setNotice(null);
                    }}
                    className={cn(
                      "min-w-[220px] xl:min-w-0 w-full text-left rounded-xl border px-3 py-3 transition-all cursor-pointer shrink-0",
                      selected
                        ? "border-accent-deep/40 bg-accent-deep/[0.08] shadow-xs"
                        : "border-transparent hover:border-mist hover:bg-paper-dim",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "text-[13px] font-bold leading-tight",
                          selected ? "text-accent-deep" : "text-ink",
                        )}
                      >
                        {job.title}
                      </span>
                      <Briefcase
                        size={15}
                        className={
                          selected ? "text-accent-deep shrink-0" : "text-ink-soft shrink-0"
                        }
                        weight={selected ? "fill" : "regular"}
                      />
                    </div>
                    <div className="text-[11px] text-ink-soft mt-1 truncate">{job.department}</div>
                    <div className="flex items-center justify-between gap-2 mt-3 text-[10.5px] text-ink-soft font-mono">
                      <span>
                        {count} {copy.apps}
                      </span>
                      <span>
                        {scored} {copy.scored}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-mist text-[11px] text-ink-soft leading-relaxed px-2">
              <span className="font-semibold text-ink">{copy.hintStrong}</span>
              {copy.hint}
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-ink-soft uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1.5 text-accent-deep">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-deep" />{" "}
                      {enterpriseJobStatusLabel(selectedJob.status, locale)}
                    </span>
                    <span>•</span>
                    <span>{enterpriseDateLabel(selectedJob.openedAt, locale)}</span>
                    <span>•</span>
                    <span>{selectedJob.department}</span>
                  </div>
                  <h2 className="text-[22px] sm:text-[25px] font-[450] text-ink tracking-[-0.025em] mt-2">
                    {selectedJob.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-soft mt-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} /> {locationLabel(selectedJob.location, locale)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase size={14} />{" "}
                      {employmentTypeLabel(selectedJob.employmentType, locale)}
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      {enterprisePayLabel(selectedJob.salaryRange, locale)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/enterprise/jobs/${selectedJob.id}`}
                    className="inline-flex items-center gap-1.5 border border-mist-dark hover:border-ink px-3.5 py-2 rounded-xl text-[12px] font-bold text-ink transition-all"
                  >
                    {t("entOpenJob")} <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                <div className="rounded-xl border border-mist bg-paper-dim p-3.5">
                  <div className="text-[10px] text-ink-soft font-mono uppercase tracking-wider">
                    {copy.metricApps}
                  </div>
                  <div className="text-[24px] font-[450] text-ink mt-1 tabular-nums">
                    {jobApplications.length}
                  </div>
                  <div className="text-[11px] text-ink-soft mt-0.5">{copy.metricAppsHint}</div>
                </div>
                <div className="rounded-xl border border-mist bg-paper-dim p-3.5">
                  <div className="text-[10px] text-ink-soft font-mono uppercase tracking-wider">
                    {copy.metricAi}
                  </div>
                  <div className="text-[24px] font-[450] text-accent-deep mt-1 tabular-nums">
                    {completedCount}
                  </div>
                  <div className="text-[11px] text-ink-soft mt-0.5">{copy.metricAiHint}</div>
                </div>
                <div className="rounded-xl border border-mist bg-paper-dim p-3.5">
                  <div className="text-[10px] text-ink-soft font-mono uppercase tracking-wider">
                    {copy.metricAvg}
                  </div>
                  <div className="text-[18px] font-[450] text-ink mt-2">Không dùng điểm</div>
                  <div className="text-[11px] text-ink-soft mt-0.5">{copy.metricAvgHint}</div>
                </div>
                <div className="rounded-xl border border-mist bg-paper-dim p-3.5">
                  <div className="text-[10px] text-ink-soft font-mono uppercase tracking-wider">
                    {copy.metricShort}
                  </div>
                  <div className="text-[24px] font-[450] text-emerald-700 mt-1 tabular-nums">
                    {shortlistedCount}
                  </div>
                  <div className="text-[11px] text-ink-soft mt-0.5">{copy.metricShortHint}</div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-mist rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div
                className="flex items-center gap-2 overflow-x-auto pb-0.5"
                role="tablist"
                aria-label={copy.filterAria}
              >
                {STAGE_FILTER_IDS.map((filterId) => {
                  const active = stageFilter === filterId;
                  const label =
                    filterId === "ALL"
                      ? t("entFilterAll")
                      : filterId === "AI_INTERVIEW_PENDING"
                        ? t("entFilterWait")
                        : filterId === "AI_INTERVIEW_COMPLETED"
                          ? t("entFilterDone")
                          : filterId === "SHORTLISTED"
                            ? t("entFilterShort")
                            : t("entFilterRoom");
                  return (
                    <button
                      key={filterId}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStageFilter(filterId)}
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-all cursor-pointer",
                        active
                          ? "bg-ink text-white"
                          : "text-ink-soft hover:bg-paper-dim hover:text-ink",
                      )}
                    >
                      {filterId === "ALL" ? (
                        <Funnel size={13} />
                      ) : filterId === "AI_INTERVIEW_PENDING" ? (
                        <Clock size={13} />
                      ) : filterId === "FACE_TO_FACE_SCHEDULED" ? (
                        <CalendarBlank size={13} />
                      ) : (
                        <CheckCircle size={13} weight={active ? "fill" : "regular"} />
                      )}
                      {label}
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          active ? "text-white/70" : "text-ink-soft/70",
                        )}
                      >
                        {stageCount(jobApplications, filterId)}
                      </span>
                    </button>
                  );
                })}
                <div className="ml-auto hidden md:flex items-center gap-2 pl-3 border-l border-mist">
                  <MagnifyingGlass size={15} className="text-ink-soft" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={copy.search}
                    className="w-40 bg-transparent text-[12px] text-ink placeholder:text-ink-soft/60 focus:outline-none"
                    aria-label={copy.searchAria}
                  />
                </div>
              </div>
              <div className="mt-3 md:hidden flex items-center gap-2 rounded-xl border border-mist bg-paper-dim px-3 py-2">
                <MagnifyingGlass size={15} className="text-ink-soft" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={copy.search}
                  className="w-full bg-transparent text-[12px] text-ink placeholder:text-ink-soft/60 focus:outline-none"
                  aria-label={copy.searchAria}
                />
              </div>
            </section>

            <section className="bg-white border border-mist rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-mist">
                <div>
                  <div className="flex items-center gap-2">
                    <Star size={16} weight="fill" className="text-accent-deep" />
                    <h2 className="text-[15px] font-bold text-ink">{copy.rankTitle}</h2>
                  </div>
                  <p className="text-[11.5px] text-ink-soft mt-1">
                    {fillCopy(copy.rankCount, {
                      n: rankedApplications.length,
                      title: selectedJob.title,
                    })}
                  </p>
                </div>
                <div className="text-[10.5px] font-mono text-ink-soft">{copy.sort}</div>
              </div>

              {rankedApplications.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-paper-dim border border-mist flex items-center justify-center text-ink-soft mb-3">
                    <ChartBar size={23} />
                  </div>
                  <h3 className="text-[16px] font-bold text-ink">{copy.rankEmpty}</h3>
                  <p className="text-[12.5px] text-ink-soft mt-1 max-w-md mx-auto">
                    {copy.rankEmptyLead}
                  </p>
                </div>
              ) : (
                <>
                  <div className="md:hidden divide-y divide-mist">
                    {rankedApplications.map((application, index) => (
                      <article key={application.id} className="px-4 py-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono text-[12px] font-bold shrink-0",
                              index === 0
                                ? "bg-accent-deep text-white"
                                : "bg-paper-dim text-ink-soft",
                            )}
                          >
                            #{index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/enterprise/candidates/${application.id}?jobId=${selectedJob.id}`}
                              className="text-[14px] font-bold text-ink hover:text-accent-deep"
                            >
                              {application.candidateName}
                            </Link>
                            <p className="text-[11.5px] text-ink-soft truncate">
                              {enterpriseRoleFallback(application.candidateRole, locale)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[12px] font-[450] text-ink">
                              Video + transcript
                            </div>
                            <div className="text-[10.5px] text-ink-soft">
                              {application.interviewDuration}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold",
                              STATUS_TONE[application.status] ??
                                "bg-paper-dim text-ink-soft border-mist",
                            )}
                          >
                            {applicationStatusLabel(application.status, locale)}
                          </span>
                          <span className="text-[11px] text-ink-soft">
                            {typeof application.cvMatch === "number"
                              ? `${application.cvMatch}%`
                              : copy.noCv}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/enterprise/candidates/${application.id}?jobId=${selectedJob.id}`}
                            className="inline-flex items-center gap-1 text-[12px] font-bold text-accent-deep"
                          >
                            {copy.view} <ArrowRight size={12} />
                          </Link>
                          {application.status === "AI_INTERVIEW_COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => advanceApplication(application)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-mist-dark px-2.5 py-1.5 text-[11px] font-bold"
                            >
                              {copy.shortlist}
                            </button>
                          )}
                          {application.status === "SHORTLISTED" && (
                            <Link
                              href={`/enterprise/candidates/${application.id}?jobId=${selectedJob.id}#schedule`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-mist-dark px-2.5 py-1.5 text-[11px] font-bold"
                            >
                              {copy.makeRoom}
                            </Link>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left">
                      <caption className="sr-only">
                        {fillCopy(copy.rankCaption, { title: selectedJob.title })}
                      </caption>
                      <thead className="bg-paper-dim border-b border-mist">
                        <tr className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
                          <th scope="col" className="px-5 py-3 w-16">
                            {copy.colRank}
                          </th>
                          <th scope="col" className="px-3 py-3">
                            {copy.colPerson}
                          </th>
                          <th scope="col" className="px-3 py-3">
                            {copy.colAi}
                          </th>
                          <th scope="col" className="px-3 py-3">
                            {copy.colCv}
                          </th>
                          <th scope="col" className="px-3 py-3">
                            {copy.colStatus}
                          </th>
                          <th scope="col" className="px-3 py-3 text-right">
                            {copy.colAct}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-mist/70">
                        {rankedApplications.map((application, index) => {
                          const canAdvance =
                            application.status === "AI_INTERVIEW_COMPLETED" ||
                            application.status === "SHORTLISTED";
                          return (
                            <tr
                              key={application.id}
                              className="hover:bg-paper-dim/70 transition-colors"
                            >
                              <td className="px-5 py-4 align-top">
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono text-[12px] font-bold",
                                    index === 0
                                      ? "bg-accent-deep text-white"
                                      : "bg-paper-dim text-ink-soft",
                                  )}
                                >
                                  #{index + 1}
                                </span>
                              </td>
                              <td className="px-3 py-4 align-top">
                                <div className="flex items-start gap-3">
                                  <div className="w-9 h-9 shrink-0 rounded-xl bg-ink text-white flex items-center justify-center text-[11px] font-bold">
                                    {application.initials}
                                  </div>
                                  <div className="min-w-0">
                                    <Link
                                      href={`/enterprise/candidates/${application.id}?jobId=${selectedJob.id}`}
                                      className="text-[13px] font-bold text-ink hover:text-accent-deep transition-colors"
                                    >
                                      {application.candidateName}
                                    </Link>
                                    <div className="text-[11.5px] text-ink-soft mt-0.5 truncate max-w-[220px]">
                                      {enterpriseRoleFallback(application.candidateRole, locale)}
                                    </div>
                                    <div className="text-[10px] text-ink-soft/70 mt-1">
                                      {enterpriseDateLabel(application.submittedAt, locale)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4 align-top">
                                <div className="text-[12px] font-[450] text-ink">
                                  Video + transcript
                                </div>
                                <div className="text-[10.5px] text-ink-soft mt-0.5">
                                  {application.interviewDuration}
                                </div>
                              </td>
                              <td className="px-3 py-4 align-top">
                                <div className="text-[12px] font-bold text-ink">
                                  {typeof application.cvMatch === "number"
                                    ? `${application.cvMatch}%`
                                    : copy.noCv}
                                </div>
                                <div className="text-[10.5px] text-ink-soft mt-0.5">
                                  {copy.cvHint}
                                </div>
                              </td>
                              <td className="px-3 py-4 align-top">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap",
                                    STATUS_TONE[application.status] ??
                                      "bg-paper-dim text-ink-soft border-mist",
                                  )}
                                >
                                  {application.status === "FACE_TO_FACE_SCHEDULED" ? (
                                    <CalendarBlank size={12} />
                                  ) : (
                                    <CheckCircle size={12} weight="fill" />
                                  )}
                                  {applicationStatusLabel(application.status, locale)}
                                </span>
                                <div className="text-[10.5px] text-ink-soft mt-2 max-w-[150px] leading-relaxed">
                                  {enterpriseNextActionLabel(application.nextAction, locale)}
                                </div>
                              </td>
                              <td className="px-3 py-4 align-top text-right">
                                <div className="flex flex-col items-end gap-2">
                                  <Link
                                    href={`/enterprise/candidates/${application.id}?jobId=${selectedJob.id}`}
                                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-accent-deep hover:underline"
                                  >
                                    {copy.view} <ArrowRight size={12} />
                                  </Link>
                                  {application.status === "AI_INTERVIEW_COMPLETED" && (
                                    <button
                                      type="button"
                                      onClick={() => advanceApplication(application)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-mist-dark hover:border-accent-deep hover:text-accent-deep px-2.5 py-1.5 text-[10.5px] font-bold transition-all"
                                    >
                                      {copy.shortlist}
                                      <ArrowRight size={12} />
                                    </button>
                                  )}
                                  {application.status === "SHORTLISTED" && (
                                    <Link
                                      href={`/enterprise/candidates/${application.id}?jobId=${selectedJob.id}#schedule`}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-mist-dark hover:border-accent-deep hover:text-accent-deep px-2.5 py-1.5 text-[10.5px] font-bold transition-all"
                                    >
                                      {copy.makeRoom}
                                      <ArrowRight size={12} />
                                    </Link>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="border-t border-mist bg-paper-dim/60 px-5 py-3 flex items-start gap-2 text-[11px] text-ink-soft leading-relaxed">
                <FileText size={14} className="mt-0.5 shrink-0 text-accent-deep" />
                <span>
                  <strong className="text-ink">{copy.how}</strong>
                  {copy.howBody}
                </span>
              </div>
            </section>

            {waitingApplications.length > 0 && (
              <section className="bg-white border border-mist rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-ink">{copy.waitingTitle}</h2>
                    <p className="text-[11.5px] text-ink-soft mt-1">{copy.waitingLead}</p>
                  </div>
                  <span className="font-mono text-[11px] text-ink-soft">
                    {fillCopy(copy.waitingN, { n: waitingApplications.length })}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {waitingApplications.map((application) => (
                    <div
                      key={application.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-mist-dark px-3.5 py-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-paper-dim text-ink-soft flex items-center justify-center text-[10px] font-bold shrink-0">
                          {application.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-ink truncate">
                            {application.candidateName}
                          </div>
                          <div className="text-[10.5px] text-ink-soft truncate">
                            {enterpriseNextActionLabel(application.nextAction, locale)}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-ink-soft shrink-0">—</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </EnterpriseAppShell>
  );
}
