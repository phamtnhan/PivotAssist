"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarBlank,
  CheckCircle,
  Clock,
  FileText,
  Sliders,
  Sparkle,
  Star,
  Users,
} from "@phosphor-icons/react";
import { EnterpriseAppShell } from "@/components/EnterpriseAppShell";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { type EnterpriseApplication, type EnterpriseJob } from "@/data/enterprise-data";
import { useLocale } from "@/lib/i18n";
import {
  enterpriseDateLabel,
  enterpriseDetailCopy,
  enterpriseJobStatusLabel,
  enterprisePayLabel,
  fillCopy,
} from "@/lib/i18n-enterprise";
import { applicationStatusLabel } from "@/lib/ui-copy";
import { apiErrorText } from "@/lib/api-errors";
import { useRealtime } from "@/lib/useRealtime";

type JobDetailTab = "jd" | "rubric" | "applicants";

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

type EnterpriseJobView = EnterpriseJob & {
  companyName?: string;
  applications?: EnterpriseApplication[];
};

export default function EnterpriseJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = typeof params?.id === "string" ? params.id : "";
  const { user, isLoading: isUserLoading } = useUser();
  const { locale } = useLocale();
  const copy = enterpriseDetailCopy(locale);
  const [job, setJob] = useState<EnterpriseJobView | null>(null);
  const [activeTab, setActiveTab] = useState<JobDetailTab>("jd");
  const [applications, setApplications] = useState<EnterpriseApplication[]>([]);
  const [dataSource, setDataSource] = useState<"empty" | "live" | "loading" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "pipeline" || event.type === "jobs") setLiveTick((current) => current + 1);
  });

  useEffect(() => {
    if (isUserLoading || !user || !["RECRUITER", "ADMIN"].includes(user.role) || !jobId) return;
    let cancelled = false;
    async function loadLiveJob() {
      try {
        const response = await fetch(`/api/enterprise/jobs/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(apiErrorText(payload, locale, copy.loadListingFail));
        if (cancelled) return;
        const liveJob = payload.job as EnterpriseJobView;
        setJob(liveJob);
        setApplications(liveJob.applications ?? []);
        setDataSource("live");
      } catch (error) {
        if (!cancelled) {
          setJob(null);
          setApplications([]);
          setDataSource("error");
          setNotice(error instanceof Error ? error.message : copy.loadListingFail);
        }
      }
    }
    void loadLiveJob();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoading, jobId, user, liveTick]);

  const rankedApplications = useMemo(
    () =>
      applications
        .filter((application) => typeof application.interviewScore === "number")
        .sort((a, b) => (b.interviewScore ?? 0) - (a.interviewScore ?? 0)),
    [applications],
  );
  const applicantRows = useMemo(
    () => [
      ...rankedApplications,
      ...applications.filter((application) => typeof application.interviewScore !== "number"),
    ],
    [rankedApplications, applications],
  );
  const evaluatedCount = rankedApplications.length;
  const shortlistedCount = applications.filter((application) =>
    ["SHORTLISTED", "FACE_TO_FACE_SCHEDULED", "HIRED"].includes(application.status),
  ).length;

  const advanceApplication = async (application: EnterpriseApplication) => {
    if (application.status !== "AI_INTERVIEW_COMPLETED") {
      setNotice(copy.roomOnProfile);
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
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id ? (payload.application as EnterpriseApplication) : item,
        ),
      );
      setNotice(fillCopy(copy.shortlistedName, { name: application.candidateName }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.updateFail);
    }
  };

  if (!job) {
    return (
      <EnterpriseAppShell>
        <div className="max-w-[760px] mx-auto py-16 text-center">
          <div className="bg-white border border-mist rounded-2xl p-10 shadow-2xs">
            <h1 className="text-xl font-bold text-ink">
              {dataSource === "loading" ? copy.jobLoading : copy.jobMissing}
            </h1>
            <p className="text-[13px] text-ink-soft mt-2">{notice ?? copy.jobGone}</p>
            <Link
              href="/enterprise/dashboard"
              className="inline-flex items-center gap-2 mt-5 text-[12.5px] font-bold text-accent-deep"
            >
              {copy.backFunnel} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </EnterpriseAppShell>
    );
  }

  return (
    <EnterpriseAppShell>
      <div className="max-w-[1240px] mx-auto animate-in fade-in duration-300 space-y-6 pb-20">
        <header className="border-b border-mist pb-5">
          <Link
            href="/enterprise/dashboard"
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-ink transition-colors mb-4"
          >
            <ArrowLeft size={14} weight="bold" /> {copy.backFunnel}
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-mono uppercase tracking-wider text-ink-soft">
                <span className="text-accent-deep inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-deep" />{" "}
                  {enterpriseJobStatusLabel(job.status, locale)}
                </span>
                <span>•</span>
                <span>{enterpriseDateLabel(job.openedAt, locale)}</span>
                <span>•</span>
                <span>{job.id}</span>
                <span>•</span>
                <span>{dataSource === "live" ? copy.live : copy.offline}</span>
              </div>
              <h1 className="text-[28px] sm:text-[34px] font-[450] text-ink tracking-[-0.03em] mt-2">
                {job.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft mt-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Users size={15} /> {job.department}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={15} /> {job.location}
                </span>
                <span className="text-emerald-700 font-semibold">
                  {enterprisePayLabel(job.salaryRange, locale)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/enterprise/jobs/create"
                className="inline-flex items-center gap-1.5 border border-mist-dark hover:border-ink px-3.5 py-2 rounded-xl text-[12px] font-bold text-ink transition-all"
              >
                <Sliders size={14} /> {copy.editListing}
              </Link>
            </div>
          </div>
        </header>

        {notice && (
          <div
            className="flex items-start gap-2 rounded-2xl border border-[#CEEAD6] bg-[#E6F4EA] px-4 py-3 text-[12.5px] text-[#137333]"
            role="status"
            aria-live="polite"
          >
            <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="ml-auto font-bold"
              aria-label={copy.closeNotice}
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              {copy.appsLabel}
            </div>
            <div className="text-[25px] font-[450] text-ink mt-1 tabular-nums">
              {applications.length}
            </div>
            <div className="text-[11px] text-ink-soft mt-0.5">{copy.metricOpen}</div>
          </div>
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              {copy.reviewedLabel}
            </div>
            <div className="text-[25px] font-[450] text-accent-deep mt-1 tabular-nums">
              {evaluatedCount}
            </div>
            <div className="text-[11px] text-ink-soft mt-0.5">{copy.metricEval}</div>
          </div>
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              {copy.movedLabel}
            </div>
            <div className="text-[25px] font-[450] text-emerald-700 mt-1 tabular-nums">
              {shortlistedCount}
            </div>
            <div className="text-[11px] text-ink-soft mt-0.5">{copy.metricMoved}</div>
          </div>
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              {copy.threshold}
            </div>
            <div className="text-[25px] font-[450] text-ink mt-1 tabular-nums">
              85<span className="text-[13px] text-ink-soft">/100</span>
            </div>
            <div className="text-[11px] text-ink-soft mt-0.5">{copy.thresholdHint}</div>
          </div>
        </div>

        <nav
          className="flex items-center gap-1 border-b border-mist overflow-x-auto"
          aria-label={copy.jobNav}
        >
          {[
            { id: "jd" as const, label: copy.tabListing, icon: FileText },
            { id: "rubric" as const, label: copy.tabRubric, icon: Sparkle },
            { id: "applicants" as const, label: copy.tabApps, icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-3 text-[12.5px] font-bold border-b-2 transition-all cursor-pointer",
                activeTab === id
                  ? "border-accent-deep text-accent-deep"
                  : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              <Icon size={15} weight={activeTab === id ? "fill" : "regular"} />
              {label}
            </button>
          ))}
        </nav>

        {activeTab === "jd" && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] gap-5">
            <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs space-y-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-accent-deep mb-2">
                  {copy.desc}
                </div>
                <h2 className="text-[18px] font-bold text-ink">{copy.roleCtx}</h2>
                <div className="space-y-3 mt-4">
                  {job.description.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed"
                    >
                      <span className="text-accent-deep mt-0.5">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-5 border-t border-mist">
                <div className="text-[10px] font-mono uppercase tracking-wider text-accent-deep mb-2">
                  {copy.req}
                </div>
                <div className="space-y-3">
                  {job.requirements.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed"
                    >
                      <CheckCircle
                        size={15}
                        weight="fill"
                        className="text-emerald-600 mt-0.5 shrink-0"
                      />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <aside className="space-y-5">
              <section className="bg-ink text-white rounded-2xl p-5 shadow-md">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-accent-deep">
                  <Sparkle size={14} weight="fill" /> {copy.aiCtx}
                </div>
                <h2 className="text-[18px] font-[450] mt-3">{copy.aiCtxTitle}</h2>
                <p className="text-[12.5px] text-white/70 leading-relaxed mt-2">{copy.aiCtxBody}</p>
                <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                  <span>{copy.criteriaN}</span>
                  <span className="text-white">{job.rubric.length}</span>
                </div>
              </section>
              <section className="bg-white border border-mist rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                  <CalendarBlank size={17} className="text-accent-deep" /> {copy.steps}
                </div>
                <div className="space-y-3 mt-4">
                  {[
                    ["1", copy.step1, fillCopy(copy.nApps, { n: applications.length })],
                    ["2", copy.step2, fillCopy(copy.nScores, { n: evaluatedCount })],
                    ["3", copy.step3, fillCopy(copy.nPeople, { n: shortlistedCount })],
                    ["4", copy.step4, copy.step4d],
                  ].map(([number, label, detail]) => (
                    <div key={number} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-paper-dim border border-mist flex items-center justify-center text-[10px] font-mono font-bold text-ink-soft shrink-0">
                        {number}
                      </span>
                      <div>
                        <div className="text-[12.5px] font-bold text-ink">{label}</div>
                        <div className="text-[11px] text-ink-soft mt-0.5">{detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}

        {activeTab === "rubric" && (
          <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-mist pb-5">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-accent-deep mb-2">
                  {copy.contract}
                </div>
                <h2 className="text-[19px] font-bold text-ink">{copy.rubricH}</h2>
                <p className="text-[12.5px] text-ink-soft mt-1 max-w-2xl">{copy.rubricP}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-ink-soft">
                <Star size={14} weight="fill" className="text-accent-deep" /> {copy.pts}
              </span>
            </div>
            <div className="divide-y divide-mist/70">
              {job.rubric.map((item, index) => (
                <div
                  key={item.label}
                  className="py-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-8 h-8 rounded-xl bg-paper-dim border border-mist text-[11px] font-mono font-bold text-ink-soft flex items-center justify-center">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="text-[14px] font-bold text-ink">{item.label}</h3>
                      <p className="text-[12px] text-ink-soft mt-1">{item.description}</p>
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <div className="flex items-center justify-between text-[10.5px] font-mono text-ink-soft mb-1.5">
                      <span>{copy.weight}</span>
                      <span className="font-bold text-ink">{item.weight}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-paper-dim overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-deep"
                        style={{ width: `${item.weight * 2.5}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "applicants" && (
          <section className="bg-white border border-mist rounded-2xl shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-mist flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Star size={16} weight="fill" className="text-accent-deep" />
                  <h2 className="text-[15px] font-bold text-ink">{copy.rankH}</h2>
                </div>
                <p className="text-[11.5px] text-ink-soft mt-1">
                  {fillCopy(copy.rankP, { n: evaluatedCount })}
                </p>
              </div>
              <span className="font-mono text-[10.5px] text-ink-soft">{job.id}</span>
            </div>
            <div className="md:hidden divide-y divide-mist/70">
              {applicantRows.map((application, index) => {
                const scored = typeof application.interviewScore === "number";
                return (
                  <div key={application.id} className="px-4 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {application.initials}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/enterprise/candidates/${application.id}?jobId=${job.id}`}
                            className="text-[13px] font-bold text-ink hover:text-accent-deep"
                          >
                            {application.candidateName}
                          </Link>
                          <p className="text-[11px] text-ink-soft truncate">
                            {application.candidateRole}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-ink-soft shrink-0">
                        {scored ? `#${index + 1}` : "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[15px] font-[450] text-ink">
                        {scored ? `${application.interviewScore}/100` : copy.none}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-bold",
                          STATUS_TONE[application.status] ??
                            "bg-paper-dim text-ink-soft border-mist",
                        )}
                      >
                        {applicationStatusLabel(application.status, locale)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/enterprise/candidates/${application.id}?jobId=${job.id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-accent-deep"
                      >
                        {copy.profile} <ArrowRight size={12} />
                      </Link>
                      {application.status === "AI_INTERVIEW_COMPLETED" ? (
                        <button
                          type="button"
                          onClick={() => advanceApplication(application)}
                          className="inline-flex items-center gap-1 border border-mist-dark rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                        >
                          {copy.stepShort}
                        </button>
                      ) : null}
                      {application.status === "SHORTLISTED" ? (
                        <Link
                          href={`/enterprise/candidates/${application.id}?jobId=${job.id}#schedule`}
                          className="inline-flex items-center gap-1 border border-mist-dark rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                        >
                          {copy.createRoom}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <caption className="sr-only">
                  {fillCopy(copy.rankCaption, { title: job.title })}
                </caption>
                <thead className="bg-paper-dim border-b border-mist">
                  <tr className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
                    <th scope="col" className="px-5 py-3">
                      #
                    </th>
                    <th scope="col" className="px-3 py-3">
                      {copy.colPerson}
                    </th>
                    <th scope="col" className="px-3 py-3">
                      {copy.colAi}
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
                  {[
                    ...rankedApplications,
                    ...applications.filter(
                      (application) => typeof application.interviewScore !== "number",
                    ),
                  ].map((application, index) => {
                    const scored = typeof application.interviewScore === "number";
                    const canAdvance =
                      application.status === "AI_INTERVIEW_COMPLETED" ||
                      application.status === "SHORTLISTED";
                    return (
                      <tr key={application.id} className="hover:bg-paper-dim/70">
                        <td className="px-5 py-4 align-top">
                          <span
                            className={cn(
                              "font-mono text-[12px] font-bold",
                              scored ? "text-ink" : "text-ink-soft/60",
                            )}
                          >
                            {scored ? `#${index + 1}` : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-ink text-white flex items-center justify-center text-[10px] font-bold">
                              {application.initials}
                            </div>
                            <div>
                              <Link
                                href={`/enterprise/candidates/${application.id}?jobId=${job.id}`}
                                className="text-[12.5px] font-bold text-ink hover:text-accent-deep"
                              >
                                {application.candidateName}
                              </Link>
                              <div className="text-[10.5px] text-ink-soft mt-0.5">
                                {application.candidateRole}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <span className="font-mono text-[17px] font-[450] text-ink">
                            {scored ? `${application.interviewScore}/100` : copy.none}
                          </span>
                          <div className="text-[10px] text-ink-soft mt-0.5">
                            {scored ? application.interviewDuration : copy.waitAi}
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap",
                              STATUS_TONE[application.status] ??
                                "bg-paper-dim text-ink-soft border-mist",
                            )}
                          >
                            {application.status === "FACE_TO_FACE_SCHEDULED" ? (
                              <CalendarBlank size={12} />
                            ) : scored ? (
                              <CheckCircle size={12} weight="fill" />
                            ) : (
                              <Clock size={12} />
                            )}
                            {applicationStatusLabel(application.status, locale)}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-top text-right">
                          <div className="flex flex-col items-end gap-2">
                            <Link
                              href={`/enterprise/candidates/${application.id}?jobId=${job.id}`}
                              className="inline-flex items-center gap-1 text-[11.5px] font-bold text-accent-deep hover:underline"
                            >
                              {copy.profile} <ArrowRight size={12} />
                            </Link>
                            {application.status === "AI_INTERVIEW_COMPLETED" && (
                              <button
                                type="button"
                                onClick={() => advanceApplication(application)}
                                className="inline-flex items-center gap-1 border border-mist-dark hover:border-accent-deep hover:text-accent-deep rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold"
                              >
                                {copy.stepShort}
                              </button>
                            )}
                            {application.status === "SHORTLISTED" && (
                              <Link
                                href={`/enterprise/candidates/${application.id}?jobId=${job.id}#schedule`}
                                className="inline-flex items-center gap-1 border border-mist-dark hover:border-accent-deep hover:text-accent-deep rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold"
                              >
                                {copy.createRoom}
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
            <div className="border-t border-mist px-5 py-3 bg-paper-dim/60 text-[11px] text-ink-soft flex items-start gap-2">
              <FileText size={14} className="mt-0.5 text-accent-deep shrink-0" />
              <span>{copy.rankFoot}</span>
            </div>
          </section>
        )}
      </div>
    </EnterpriseAppShell>
  );
}
