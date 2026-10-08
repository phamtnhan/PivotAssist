"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  MagnifyingGlass,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  Sparkle,
  CheckCircle,
  FileText,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  fromServerApplication,
  type ServerApplicationPayload,
  type CandidateApplicationRecord,
} from "@/lib/application-store";
import { useUser } from "@/lib/useUser";
import { employmentTypeLabel, locationLabel } from "@/lib/ui-copy";
import { useLocale, type Locale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import { useRealtime } from "@/lib/useRealtime";
import { persistPreferenceList, readLocalIdList, writeLocalIdList } from "@/lib/preference-sync";
import { asIdList } from "@/lib/id-list";

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  specificAddress: string;
  salary: string;
  postedTime: string;
  category: string;
  level: string;
  hiringCount: number;
  matchScore: number;
  description: string[];
  requirements: string[];
  benefits: string[];
  matchedSkills: string[];
  missingSkills: string[];
}

interface PublicJobApiRecord {
  id: string;
  companyName?: string;
  title: string;
  location: string;
  employmentType?: string;
  salaryRange?: string;
  hiringCount?: number;
  department?: string;
  postedAt?: string;
  descriptionHtml?: string;
  requiredSkills?: Array<{ name?: string }>;
  niceToHaveSkills?: Array<{ name?: string }>;
  matchScorecard?: {
    overallScore?: number;
    matchedSkills?: string[];
    missingRequiredSkills?: string[];
    missingNiceToHaveSkills?: string[];
  };
}

const LOCATION_QUERY: Record<string, string> = {
  vp: "Vĩnh Phúc",
  kh: "Khánh Hòa",
  hy: "Hưng Yên",
  hn: "Hà Nội",
  hcm: "Hồ Chí Minh",
  dn: "Đồng Nai",
  dad: "Đà Nẵng",
  hp: "Hải Phòng",
};

function fromPublicJobApi(
  job: PublicJobApiRecord,
  locale: Locale,
  t: (
    key:
      | "jobsCompany"
      | "jobsNegotiable"
      | "jobsDept"
      | "jobsDescPending"
      | "jobsReqSkill"
      | "jobsBenefitDefault",
    vars?: Record<string, string | number>,
  ) => string,
): JobListing {
  const lines = (job.descriptionHtml ?? "")
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
  const requiredSkills = (job.requiredSkills ?? [])
    .map((skill) => skill.name)
    .filter((name): name is string => Boolean(name));
  const matched = job.matchScorecard?.matchedSkills ?? [];
  const missing = [
    ...(job.matchScorecard?.missingRequiredSkills ?? []),
    ...(job.matchScorecard?.missingNiceToHaveSkills ?? []),
  ];
  const place = locationLabel(job.location, locale);
  return {
    id: job.id,
    title: job.title,
    company: job.companyName ?? t("jobsCompany"),
    location: place,
    specificAddress: place,
    salary: job.salaryRange ?? t("jobsNegotiable"),
    postedTime: job.postedAt
      ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(new Date(job.postedAt))
      : "—",
    category: job.department ?? t("jobsDept"),
    level: employmentTypeLabel(job.employmentType, locale),
    hiringCount: job.hiringCount ?? 1,
    matchScore: job.matchScorecard?.overallScore ?? 0,
    description: lines.length > 0 ? lines : [t("jobsDescPending")],
    requirements:
      requiredSkills.length > 0
        ? requiredSkills.map((skill) => t("jobsReqSkill", { skill }))
        : lines,
    benefits: [t("jobsBenefitDefault")],
    matchedSkills: matched,
    missingSkills: missing,
  };
}

export default function JobsClient({
  initialJobs = [],
  initialTotal = 0,
}: {
  initialJobs?: PublicJobApiRecord[];
  initialTotal?: number;
}) {
  const { user, isLoading: isUserLoading } = useUser();
  const { t, locale } = useLocale();
  const [jobData, setJobData] = useState<JobListing[]>(() =>
    initialJobs.map((job) => fromPublicJobApi(job, locale, t)),
  );
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobs[0]?.id ?? "");
  const [jobsTotal, setJobsTotal] = useState(initialTotal);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(() => Math.max(1, Math.ceil(initialTotal / 30)));
  const [isLoadingJobs, setIsLoadingJobs] = useState(initialJobs.length === 0);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);
  const [candidateApplications, setCandidateApplications] = useState<CandidateApplicationRecord[]>(
    [],
  );
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);
  const [applicationNotice, setApplicationNotice] = useState<string | null>(null);
  const [applicationNoticeTone, setApplicationNoticeTone] = useState<"success" | "error">(
    "success",
  );
  const [isApplying, setIsApplying] = useState(false);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [showMatchSummary, setShowMatchSummary] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "jobs" || event.type === "notification")
      setLiveTick((current) => current + 1);
  });

  useEffect(() => {
    const key = `pivotassist:jobBookmarks:${user?.userId ?? "anon"}`;
    const local = readLocalIdList(key);
    if (!user) {
      setBookmarkedIds(local);
      return;
    }
    let cancelled = false;
    async function hydrateBookmarks() {
      const response = await fetch("/api/profile", { cache: "no-store" }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (cancelled) return;
      const remote = asIdList(payload?.user?.preferencesJson?.jobBookmarks);
      if (remote.length > 0) {
        setBookmarkedIds(remote);
        writeLocalIdList(key, remote);
        return;
      }
      setBookmarkedIds(local);
      if (local.length > 0) void persistPreferenceList("jobBookmarks", local);
    }
    void hydrateBookmarks();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (isUserLoading) return;
    let cancelled = false;

    async function loadApplications() {
      if (!user) {
        setCandidateApplications([]);
        setAppliedJobIds([]);
        return;
      }

      try {
        const response = await fetch("/api/applications", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(apiErrorText(payload, locale, t("jobsAppsErr")));
        const serverApplications = ((payload.applications as ServerApplicationPayload[]) ?? []).map(
          fromServerApplication,
        );
        if (!cancelled) {
          setCandidateApplications(serverApplications);
          setAppliedJobIds(serverApplications.map((application) => application.jobId));
        }
      } catch {
        if (!cancelled) {
          setCandidateApplications([]);
          setAppliedJobIds([]);
          setApplicationNotice(t("jobsSyncErr"));
          setApplicationNoticeTone("error");
        }
      }
    }

    async function loadJobs() {
      // SSR already filled the first page. Guest/recruiter do not need matchScorecard.
      // CANDIDATE, page change, and realtime `jobs` events hit /api/jobs.
      const hasServerFilter = Boolean(
        searchQuery.trim() || locationFilter !== "all" || categoryFilter !== "all",
      );
      const needsLiveListing =
        liveTick > 0 || user?.role === "CANDIDATE" || currentPage > 1 || hasServerFilter;
      if (!needsLiveListing && initialJobs.length > 0 && currentPage === 1) {
        setIsLoadingJobs(false);
        return;
      }
      setIsLoadingJobs((current) => current && jobData.length === 0);
      setJobsError(null);
      try {
        const params = new URLSearchParams({ page: String(currentPage), pageSize: "30" });
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (locationFilter !== "all")
          params.set("location", LOCATION_QUERY[locationFilter] ?? locationFilter);
        if (categoryFilter !== "all") params.set("department", categoryFilter);
        const response = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(apiErrorText(payload, locale, t("jobsLoadErr")));
        const liveJobs = (payload.jobs as PublicJobApiRecord[]).map((job) =>
          fromPublicJobApi(job, locale, t),
        );
        if (!cancelled) {
          setJobData(liveJobs);
          const totalCount = typeof payload.total === "number" ? payload.total : liveJobs.length;
          setJobsTotal(totalCount);
          setTotalPages(
            typeof payload.totalPages === "number"
              ? payload.totalPages
              : Math.max(1, Math.ceil(totalCount / 30)),
          );
          setSelectedJobId((current) => {
            const fromUrl = new URLSearchParams(window.location.search).get("jobId");
            if (fromUrl && liveJobs.some((job) => job.id === fromUrl)) {
              setMobileShowDetail(true);
              return fromUrl;
            }
            return liveJobs.some((job) => job.id === current) ? current : (liveJobs[0]?.id ?? "");
          });
        }
      } catch (error) {
        if (!cancelled) {
          setJobData([]);
          setJobsTotal(0);
          setTotalPages(1);
          setJobsError(error instanceof Error ? error.message : t("jobsLoadErr"));
        }
      } finally {
        if (!cancelled) setIsLoadingJobs(false);
      }
    }

    void loadApplications();
    void loadJobs();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isUserLoading,
    user,
    liveTick,
    locale,
    t,
    currentPage,
    searchQuery,
    locationFilter,
    categoryFilter,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, locationFilter, categoryFilter]);

  useEffect(() => {
    if (!selectedJobId) return;
    let cancelled = false;
    async function loadDetail() {
      const response = await fetch(`/api/jobs/${encodeURIComponent(selectedJobId)}`, {
        cache: "no-store",
      }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (cancelled || !response?.ok || !payload?.success || !payload.job) return;
      const detail = fromPublicJobApi(payload.job as PublicJobApiRecord, locale, t);
      setJobData((current) =>
        current.map((job) => {
          if (job.id !== detail.id) return job;
          return {
            ...detail,
            matchScore: detail.matchScore || job.matchScore,
            matchedSkills:
              detail.matchedSkills.length > 0 ? detail.matchedSkills : job.matchedSkills,
            missingSkills:
              detail.missingSkills.length > 0 ? detail.missingSkills : job.missingSkills,
          };
        }),
      );
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId, locale, t]);

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      writeLocalIdList(`pivotassist:jobBookmarks:${user?.userId ?? "anon"}`, next);
      if (user) void persistPreferenceList("jobBookmarks", next);
      return next;
    });
  };

  const selectedJob = jobData.find((j) => j.id === selectedJobId) ?? jobData[0];
  const selectedApplication = selectedJob
    ? candidateApplications.find((application) => application.jobId === selectedJob.id)
    : undefined;
  const isSelectedJobApplied = selectedJob ? appliedJobIds.includes(selectedJob.id) : false;

  const handleApply = async () => {
    if (!selectedJob || isApplying || isSelectedJobApplied) return;
    if (!user) {
      setApplicationNotice(t("jobsNeedLogin"));
      setApplicationNoticeTone("error");
      return;
    }
    setIsApplying(true);
    setApplicationNotice(null);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        if (payload?.code === "RESUME_REQUIRED") throw new Error(t("jobsNeedCv"));
        throw new Error(apiErrorText(payload, locale, t("jobsApplyFail")));
      }
      const listResponse = await fetch("/api/applications", { cache: "no-store" });
      const listPayload = await listResponse.json().catch(() => null);
      if (listResponse.ok && listPayload?.success) {
        const serverApplications = (
          (listPayload.applications as ServerApplicationPayload[]) ?? []
        ).map(fromServerApplication);
        setCandidateApplications(serverApplications);
        setAppliedJobIds(serverApplications.map((application) => application.jobId));
      } else {
        setAppliedJobIds((previous) =>
          previous.includes(selectedJob.id) ? previous : [...previous, selectedJob.id],
        );
      }
      setApplicationNotice(t("jobsAppliedOk", { title: selectedJob.title }));
      setApplicationNoticeTone("success");
    } catch (error) {
      setApplicationNotice(error instanceof Error ? error.message : t("jobsApplyFail"));
      setApplicationNoticeTone("error");
    } finally {
      setIsApplying(false);
    }
  };

  const filteredJobs = showOnlyBookmarked
    ? jobData.filter((job) => bookmarkedIds.includes(job.id))
    : jobData;

  return (
    <div className="max-w-[1240px] mx-auto animate-in fade-in duration-300 font-sans pb-20">
      {/* =========================================================================
          1. HEADER & DISCOVERY TELEMETRY
          ========================================================================= */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(183,191,217,0.14)] text-[#121317] text-[11.5px] font-[450] tracking-tight mb-2">
            <Sparkle size={13} weight="fill" className="text-[#1A73E8]" />
            {t("jobsEyebrow")}
          </div>
          <h1 className="font-sans font-[450] text-2xl sm:text-3xl text-[#121317] tracking-[-0.02em]">
            {t("jobsTitle")}
          </h1>
          <p className="text-[14px] text-[#45474D] mt-1 font-normal">{t("jobsLead")}</p>
        </div>

        <div className="flex items-center gap-2 text-[12.5px] text-[#45474D]">
          <span>{t("jobsMatchLabel")}:</span>
          <span className="font-[450] text-[#1A73E8] bg-[#E8F0FE] px-3 py-1 rounded-full">
            {t("jobsAvailable", { count: filteredJobs.length })}
          </span>
        </div>
      </div>

      {/* =========================================================================
          2. FILTER & SEARCH COMMAND BAR
          ========================================================================= */}
      <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-4 shadow-2xs mb-6 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlass
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#45474D]/60"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("jobsSearch")}
              className="w-full bg-[#F8F9FA] hover:bg-white focus:bg-white border border-[rgba(33,34,38,0.1)] focus:border-[#1A73E8] rounded-full pl-10 pr-4 py-2 text-[13px] text-[#121317] placeholder:text-[#45474D]/50 focus:outline-none focus:ring-1 focus:ring-[#1A73E8] transition-all"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            <button
              onClick={() => setShowOnlyBookmarked(!showOnlyBookmarked)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-[12.5px] font-[450] border transition-all flex items-center gap-1.5 cursor-pointer",
                showOnlyBookmarked
                  ? "bg-[#E8F0FE] border-[#D2E3FC] text-[#1A73E8]"
                  : "bg-white border-[rgba(33,34,38,0.1)] text-[#45474D] hover:text-[#121317]",
              )}
            >
              <BookmarkSimple size={15} weight={showOnlyBookmarked ? "fill" : "regular"} />
              {t("jobsSaved")} ({bookmarkedIds.length})
            </button>
            <span className="text-[11.5px] text-[#45474D] hidden sm:inline">
              {t("jobsBookmarkLocal")}
            </span>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-[rgba(33,34,38,0.1)] text-[#45474D] rounded-full px-3.5 py-1.5 text-[12.5px] font-[450] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
            >
              <option value="all">{t("jobsAllCats")}</option>
              <option value="Kỹ thuật">{t("jobsCatTech")}</option>
              <option value="Kế toán">{t("jobsCatAcc")}</option>
              <option value="Quản lý chất lượng">{t("jobsCatQa")}</option>
              <option value="Marketing">{t("jobsCatMkt")}</option>
              <option value="Kinh doanh">{t("jobsCatSales")}</option>
            </select>
          </div>
        </div>

        {/* Location Pills Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-t border-[rgba(33,34,38,0.06)] pt-2.5">
          <span className="text-[12px] font-[450] text-[#45474D] mr-1 whitespace-nowrap">
            {t("jobsPlace")}
          </span>
          {[
            { id: "all", label: t("jobsAllPlaces") },
            { id: "vp", label: "Vĩnh Phúc" },
            { id: "kh", label: "Khánh Hòa" },
            { id: "hy", label: "Hưng Yên" },
            { id: "hn", label: "Hà Nội" },
            { id: "hcm", label: "TP. Hồ Chí Minh" },
            { id: "dn", label: "Đồng Nai" },
            { id: "dad", label: "Đà Nẵng" },
            { id: "hp", label: "Hải Phòng" },
          ].map((loc) => (
            <button
              key={loc.id}
              onClick={() => setLocationFilter(loc.id)}
              className={cn(
                "px-3 py-1 rounded-full text-[12px] font-[450] whitespace-nowrap transition-all cursor-pointer",
                locationFilter === loc.id
                  ? "bg-[#121317] text-white shadow-xs"
                  : "bg-[#F8F9FA] text-[#45474D] hover:text-[#121317] hover:bg-black/[0.04]",
              )}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          3. MASTER-DETAIL WORKSPACE (Left: Job Feed 5 cols, Right: Inspector 7 cols)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 10 JOB LIST CARDS */}
        <div
          className={cn(
            "lg:col-span-5 flex-col gap-3",
            mobileShowDetail ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="flex items-center justify-between text-[12px] text-ink-soft px-1 mb-0.5">
            <span>{t("jobsShowing", { shown: filteredJobs.length, total: jobsTotal })}</span>
            <span>
              {isLoadingJobs
                ? t("jobsLoadShort")
                : jobsError
                  ? t("jobsLoadFail")
                  : `${locale === "en" ? "Page" : "Trang"} ${currentPage}`}
            </span>
          </div>

          <div className="flex flex-col gap-3 max-h-[820px] overflow-y-auto pr-1">
            {filteredJobs.map((job) => {
              const isSelected = job.id === selectedJobId;
              const isBookmarked = bookmarkedIds.includes(job.id);

              return (
                <div
                  key={job.id}
                  onClick={() => {
                    setSelectedJobId(job.id);
                    setMobileShowDetail(true);
                  }}
                  className={cn(
                    "p-4 rounded-[20px] border transition-all cursor-pointer relative",
                    isSelected
                      ? "bg-white border-[#121317] shadow-xs ring-1 ring-[#121317]/10"
                      : "bg-white border-[rgba(33,34,38,0.08)] hover:border-[rgba(33,34,38,0.18)] hover:bg-[#F8F9FA]/60",
                  )}
                >
                  {/* Top: Title & Bookmark */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="font-sans font-[450] text-[14.5px] text-[#121317] leading-snug">
                      {job.title}
                    </h3>

                    <button
                      onClick={(e) => toggleBookmark(job.id, e)}
                      className="p-1 rounded-full text-[#45474D]/50 hover:text-[#121317] hover:bg-[#F8F9FA] transition-colors shrink-0 cursor-pointer"
                      title={isBookmarked ? t("jobsUnsave") : t("jobsSave")}
                    >
                      <BookmarkSimple
                        size={16}
                        weight={isBookmarked ? "fill" : "regular"}
                        className={isBookmarked ? "text-[#121317]" : ""}
                      />
                    </button>
                  </div>

                  {/* Company & Location */}
                  <div className="text-[12.5px] text-[#45474D] mb-2.5 font-normal">
                    <span className="font-[450] text-[#121317]">{job.company}</span> •{" "}
                    <span>{job.location}</span>
                  </div>

                  {/* Salary & Posted Time */}
                  <div className="pt-2.5 border-t border-[rgba(33,34,38,0.06)] flex items-center justify-between text-[12px]">
                    <span className="font-[450] text-[#137333]">{job.salary}</span>
                    <span className="text-[#45474D] font-normal">
                      {t("jobsPosted", { time: job.postedTime })}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredJobs.length === 0 && (
              <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[20px] p-8 text-center text-[#45474D] text-[13px]">
                {isLoadingJobs ? t("jobsLoading") : (jobsError ?? t("jobsNoFilter"))}
              </div>
            )}
          </div>

          {/* Clean Pagination Control */}
          <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-full px-4 py-2.5 flex items-center justify-between text-[12.5px] font-[450] text-[#45474D] mt-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoadingJobs}
              className="flex items-center gap-1 hover:text-[#121317] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <CaretLeft size={14} /> {t("jobsPrev")}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-full bg-[#121317] text-white font-[450] flex items-center justify-center text-[11.5px]">
                {currentPage}
              </span>
              {totalPages > 1 && (
                <span className="text-[11.5px] text-[#45474D]">/ {totalPages}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoadingJobs}
              className="flex items-center gap-1 hover:text-[#121317] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              {t("jobsNext")} <CaretRight size={14} />
            </button>
          </div>
        </div>

        {/* Cột phải: nội dung tin và thao tác */}
        {!selectedJob ? (
          <div
            className={cn(
              "lg:col-span-7 bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-10 shadow-2xs text-center",
              mobileShowDetail ? "block" : "hidden lg:block",
            )}
          >
            <h2 className="text-[18px] font-[450] text-[#121317]">
              {isLoadingJobs ? t("jobsLoading") : t("homeNoJobs")}
            </h2>
            <p className="text-[13px] text-[#45474D] mt-2">{jobsError ?? t("jobsEmptyLead")}</p>
          </div>
        ) : (
          <div
            className={cn(
              "lg:col-span-7 bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 lg:p-7 shadow-2xs lg:sticky lg:top-24 flex-col gap-6",
              mobileShowDetail ? "flex" : "hidden lg:flex",
            )}
          >
            <button
              type="button"
              onClick={() => setMobileShowDetail(false)}
              className="lg:hidden inline-flex items-center gap-1.5 text-[12.5px] font-[450] text-[#1A73E8] self-start"
            >
              <CaretLeft size={14} /> {t("jobsBack")}
            </button>

            {/* Top Job Overview Header */}
            <div className="border-b border-[rgba(33,34,38,0.06)] pb-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                <div>
                  <div className="text-[11px] font-[450] text-[#45474D] uppercase tracking-wider mb-1">
                    {selectedJob.company} • {selectedJob.category}
                  </div>
                  <h2 className="font-sans font-[450] text-[22px] text-[#121317] leading-tight">
                    {selectedJob.title}
                  </h2>
                  <div className="text-[13px] text-[#45474D] mt-1 font-normal">
                    {selectedJob.specificAddress}
                  </div>
                </div>
              </div>

              {/* Compensation & Quota Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="bg-[#E6F4EA] border border-[#CEEAD6] rounded-xl p-2.5">
                  <div className="text-[11px] text-[#137333] font-medium">{t("jobsSalary")}</div>
                  <div className="text-[13px] font-[450] text-[#0D652D] truncate">
                    {selectedJob.salary}
                  </div>
                </div>

                <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] rounded-xl p-2.5">
                  <div className="text-[11px] text-[#45474D] font-medium">{t("jobsQuota")}</div>
                  <div className="text-[13px] font-[450] text-[#121317]">
                    {t("jobsQuotaN", { count: selectedJob.hiringCount })}
                  </div>
                </div>

                <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] rounded-xl p-2.5 col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-[#45474D] font-medium">{t("jobsPostedAt")}</div>
                  <div className="text-[13px] font-[450] text-[#121317]">
                    {selectedJob.postedTime}
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Prominent AI Co-Pilot Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <Link
                href={
                  isSelectedJobApplied
                    ? `/interview/setup?applicationId=${encodeURIComponent(selectedApplication?.applicationId ?? "")}&jobId=${encodeURIComponent(selectedJob.id)}&role=${encodeURIComponent(selectedJob.title)}`
                    : `/interview/setup?role=${encodeURIComponent(selectedJob.title)}`
                }
                className="bg-[#121317] hover:bg-[#2D3139] active:scale-[0.98] text-white py-2.5 px-3 rounded-full font-[450] text-[12.5px] flex items-center justify-center gap-1.5 shadow-xs transition-all text-center cursor-pointer"
              >
                {isSelectedJobApplied ? t("homeStartInterview") : t("jobsPractice")}{" "}
                <ArrowRight size={13} weight="bold" />
              </Link>

              <button
                type="button"
                onClick={() => setShowMatchSummary((previous) => !previous)}
                className="bg-[#F8F9FA] hover:bg-black/[0.04] text-[#121317] border border-[rgba(33,34,38,0.1)] py-2.5 px-3 rounded-full font-[450] text-[12.5px] transition-all text-center cursor-pointer"
                aria-expanded={showMatchSummary}
              >
                {showMatchSummary ? t("jobsHideMatch") : t("jobsMatchCv")}
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={isSelectedJobApplied}
                className={cn(
                  "py-2.5 px-3 rounded-full font-[450] text-[12.5px] transition-all text-center inline-flex items-center justify-center gap-1.5",
                  isSelectedJobApplied
                    ? "bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] cursor-default"
                    : "bg-[#E8F0FE] hover:bg-[#D2E3FC] text-[#1A73E8] cursor-pointer",
                )}
              >
                {isApplying ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : isSelectedJobApplied ? (
                  <CheckCircle size={14} weight="fill" />
                ) : (
                  <FileText size={14} />
                )}
                {isApplying
                  ? t("jobsApplying")
                  : isSelectedJobApplied
                    ? t("jobsApplied")
                    : t("jobsApply")}
              </button>
            </div>

            {(applicationNotice || showMatchSummary) && (
              <div className="space-y-2" aria-live="polite">
                {applicationNotice && (
                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-2xl px-3.5 py-3 text-[12.5px]",
                      applicationNoticeTone === "error"
                        ? "border border-[#FAD2CF] bg-[#FCE8E6] text-[#C5221F]"
                        : "border border-[#CEEAD6] bg-[#E6F4EA] text-[#137333]",
                    )}
                  >
                    {applicationNoticeTone === "error" ? (
                      <span className="font-bold shrink-0 mt-0.5">!</span>
                    ) : (
                      <CheckCircle size={16} weight="fill" className="shrink-0 mt-0.5" />
                    )}
                    <span>{applicationNotice}</span>
                  </div>
                )}
                {showMatchSummary && (
                  <div className="rounded-2xl border border-[#D2E3FC] bg-[#F8FBFF] px-3.5 py-3 text-[12.5px] text-[#45474D]">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-[#121317] font-[450]">{t("jobsCompare")}</strong>
                      <span className="text-[11px] text-[#1A73E8]">{t("jobsCompareHint")}</span>
                    </div>
                    <p className="mt-1 leading-relaxed">
                      {t("jobsCompareLead", {
                        matched: selectedJob.matchedSkills.length,
                        missing: selectedJob.missingSkills.length,
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* AI Skill Match Matrix */}
            <div>
              <h3 className="font-sans font-[450] text-[13px] text-[#121317] mb-2.5 uppercase tracking-wide">
                {t("jobsSkillMatrix")}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Matched Skills */}
                <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] rounded-2xl p-3.5">
                  <div className="text-[11px] font-[450] text-[#137333] uppercase tracking-wider mb-2">
                    {t("jobsMatched", { count: selectedJob.matchedSkills.length })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.matchedSkills.length === 0 ? (
                      <span className="text-[11.5px] text-[#45474D]">
                        {user ? t("jobsNoMatchUser") : t("jobsNoMatchGuest")}
                      </span>
                    ) : (
                      selectedJob.matchedSkills.map((s) => (
                        <span
                          key={s}
                          className="bg-white border border-[#CEEAD6] text-[#137333] text-[11.5px] font-normal px-2.5 py-0.5 rounded-full"
                        >
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] rounded-2xl p-3.5">
                  <div className="text-[11px] font-[450] text-[#B06000] uppercase tracking-wider mb-2">
                    {t("jobsMissing", { count: selectedJob.missingSkills.length })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.missingSkills.map((s) => (
                      <span
                        key={s}
                        className="bg-white border border-[#FEEFC3] text-[#B06000] text-[11.5px] font-normal px-2.5 py-0.5 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Job Details: Description, Requirements, Benefits */}
            <div className="space-y-4 text-[13px] text-[#121317] leading-relaxed">
              {/* Description */}
              <div>
                <h4 className="font-sans font-[450] text-[#121317] mb-1.5 uppercase tracking-wide text-[11.5px]">
                  {t("jobsDetail")}
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-[#45474D]">
                  {selectedJob.description.map((item, idx) => (
                    <li key={idx} className="leading-relaxed font-normal">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Requirements */}
              <div>
                <h4 className="font-sans font-[450] text-[#121317] mb-1.5 uppercase tracking-wide text-[11.5px]">
                  {t("jobsReq")}
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-[#45474D]">
                  {selectedJob.requirements.map((item, idx) => (
                    <li key={idx} className="leading-relaxed font-normal">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Benefits */}
              <div>
                <h4 className="font-sans font-[450] text-[#121317] mb-1.5 uppercase tracking-wide text-[11.5px]">
                  {t("jobsPerk")}
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-[#45474D]">
                  {selectedJob.benefits.map((item, idx) => (
                    <li key={idx} className="leading-relaxed font-normal">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
