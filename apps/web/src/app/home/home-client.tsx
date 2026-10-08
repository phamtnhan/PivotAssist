"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import {
  ArrowRight,
  VideoCamera,
  CheckCircle,
  Sparkle,
  Briefcase,
  UploadSimple,
  FolderOpen,
  FilePdf,
  Lightning,
  Microphone,
  CaretRight,
  ShieldCheck,
  BuildingOffice,
  MapPin,
  ChartLineUp,
  UserCheck,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { applicationStatusLabel, employmentTypeLabel, locationLabel } from "@/lib/ui-copy";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import { SUPPORTED_RESUME_ACCEPT } from "@/lib/resume-formats";
import { useRealtime } from "@/lib/useRealtime";

type HomeJobCard = { id: string; title: string; company: string; loc: string };
type HomeSnap = {
  jobs: HomeJobCard[];
  jobsTotal: number;
  hasResume: boolean;
  resumeName: string | null;
  resumeMeta: { fullName: string | null; title: string | null; skills: string[] };
};

function readHomeSnap(): HomeSnap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("pivotassist:home-snap");
    return raw ? (JSON.parse(raw) as HomeSnap) : null;
  } catch {
    return null;
  }
}

export default function HomeClient({
  initialJobs = [],
  initialTotal = 0,
}: {
  initialJobs?: HomeJobCard[];
  initialTotal?: number;
}) {
  const router = useRouter();
  const { displayName, user, refreshUser } = useUser();
  const { t, locale } = useLocale();
  const [activeMode, setActiveMode] = useState<"cv" | "jd" | "role" | "speed">("cv");
  const [jdFile, setJdFile] = useState<{ name: string; size: string } | null>(null);
  const [jdText, setJdText] = useState("");
  const [jdError, setJdError] = useState<string | null>(null);
  const [isDraggingJd, setIsDraggingJd] = useState(false);
  const jdFileInputRef = useRef<HTMLInputElement | null>(null);
  const [homeStats, setHomeStats] = useState({
    sessions: 0,
    completed: 0,
    averageScore: 0,
    atsScore: 0,
  });
  const [featuredJobs, setFeaturedJobs] = useState<HomeJobCard[]>(initialJobs);
  const [jobsReady, setJobsReady] = useState(initialJobs.length > 0);
  const [jobsTotal, setJobsTotal] = useState(initialTotal);
  const [recentApplications, setRecentApplications] = useState<
    Array<{ id: string; title: string; status: string; interviewId?: string }>
  >([]);
  const [hasResume, setHasResume] = useState(false);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [resumeMeta, setResumeMeta] = useState<{
    fullName: string | null;
    title: string | null;
    skills: string[];
  }>({ fullName: null, title: null, skills: [] });
  const [cvUploading, setCvUploading] = useState(false);
  const [cvMessage, setCvMessage] = useState<string | null>(null);
  const [jdResumeFile, setJdResumeFile] = useState<File | null>(null);
  const cvInputRef = useRef<HTMLInputElement | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "jobs" || event.type === "notification")
      setLiveTick((current) => current + 1);
  });

  useEffect(() => {
    const snap = readHomeSnap();
    if (!snap) return;
    if (snap.jobs.length > 0) {
      setFeaturedJobs(snap.jobs);
      setJobsTotal(snap.jobsTotal);
      setJobsReady(true);
    }
    if (snap.hasResume) {
      setHasResume(true);
      setResumeName(snap.resumeName);
      setResumeMeta(snap.resumeMeta);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadJobs() {
      const jobsResponse = await fetch("/api/jobs?pageSize=3", { cache: "no-store" }).catch(
        () => null,
      );
      const jobsPayload = await jobsResponse?.json().catch(() => null);
      if (cancelled) return;
      const liveJobs = (jobsPayload?.jobs ?? [])
        .slice(0, 3)
        .map(
          (job: {
            id: string;
            title: string;
            companyName?: string;
            location?: string;
            employmentType?: string;
          }) => ({
            id: job.id,
            title: job.title,
            company: job.companyName ?? t("homeCompany"),
            loc: [
              locationLabel(job.location, locale),
              employmentTypeLabel(job.employmentType, locale),
            ]
              .filter((part) => part && part !== "—")
              .join(" · "),
          }),
        );
      setFeaturedJobs(liveJobs);
      const total = typeof jobsPayload?.total === "number" ? jobsPayload.total : liveJobs.length;
      setJobsTotal(total);
      setJobsReady(true);
      try {
        const prev = readHomeSnap();
        window.sessionStorage.setItem(
          "pivotassist:home-snap",
          JSON.stringify({
            jobs: liveJobs,
            jobsTotal: total,
            hasResume: prev?.hasResume ?? false,
            resumeName: prev?.resumeName ?? null,
            resumeMeta: prev?.resumeMeta ?? { fullName: null, title: null, skills: [] },
          } satisfies HomeSnap),
        );
      } catch {
        /* quota */
      }
    }
    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, [liveTick, locale, t]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadStats() {
      const [applicationsResponse, resumeResponse] = await Promise.all([
        fetch("/api/applications", { cache: "no-store" }).catch(() => null),
        fetch("/api/resumes", { cache: "no-store" }).catch(() => null),
      ]);
      const applicationsPayload = await applicationsResponse?.json().catch(() => null);
      const resumePayload = await resumeResponse?.json().catch(() => null);
      if (cancelled) return;
      const applications = applicationsPayload?.applications ?? [];
      const scores = applications.flatMap(
        (application: {
          interviews?: Array<{ interviewScore?: { overallScore?: number } | null }>;
        }) =>
          (application.interviews ?? [])
            .map((interview) => interview.interviewScore?.overallScore)
            .filter((score): score is number => typeof score === "number"),
      );
      setHomeStats({
        sessions: applications.reduce(
          (sum: number, application: { interviews?: unknown[] }) =>
            sum + (application.interviews?.length ?? 0),
          0,
        ),
        completed: scores.length,
        averageScore: scores.length
          ? Math.round(
              scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length,
            )
          : 0,
        atsScore: Array.isArray(resumePayload?.resumes?.[0]?.parsed?.extractedSkills)
          ? resumePayload.resumes[0].parsed.extractedSkills.length
          : 0,
      });
      setRecentApplications(
        applications
          .slice(0, 3)
          .map(
            (application: {
              id: string;
              job?: { title?: string };
              status: string;
              interviews?: Array<{ id: string }>;
            }) => ({
              id: application.id,
              title: application.job?.title ?? t("homeAppTitle"),
              status: applicationStatusLabel(application.status, locale),
              interviewId: application.interviews?.[0]?.id,
            }),
          ),
      );
      const activeResume = resumePayload?.resumes?.[0];
      setHasResume(Boolean(activeResume));
      setResumeName(activeResume?.filename ?? null);
      const nextMeta = {
        fullName: activeResume?.parsed?.fullName ?? null,
        title: activeResume?.parsed?.currentJobTitle ?? null,
        skills: Array.isArray(activeResume?.parsed?.extractedSkills)
          ? activeResume.parsed.extractedSkills.slice(0, 8)
          : [],
      };
      setResumeMeta(nextMeta);
      try {
        const prev = readHomeSnap();
        window.sessionStorage.setItem(
          "pivotassist:home-snap",
          JSON.stringify({
            jobs: prev?.jobs ?? [],
            jobsTotal: prev?.jobsTotal ?? 0,
            hasResume: Boolean(activeResume),
            resumeName: activeResume?.filename ?? null,
            resumeMeta: nextMeta,
          } satisfies HomeSnap),
        );
      } catch {
        /* quota */
      }
    }
    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [user, liveTick, locale, t]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "RECRUITER") router.replace("/enterprise/dashboard");
    if (user.role === "ADMIN") router.replace("/admin");
  }, [user, router]);

  const handleJdFile = async (file: File) => {
    if (!/\.(pdf|md|txt|docx)$/i.test(file.name)) {
      setJdError(t("homeJdTypeError"));
      return;
    }
    setJdError(null);
    setJdResumeFile(null);
    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;
    setJdFile({ name: file.name, size: sizeStr });
    if (/\.(md|txt)$/i.test(file.name)) {
      const text = await file.text();
      setJdText(text.slice(0, 20_000));
      window.sessionStorage.setItem("pivotassist:practiceJd", text.slice(0, 20_000));
      window.sessionStorage.setItem(
        "pivotassist:practiceRole",
        file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      );
      return;
    }
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/interviews/jd-parse", { method: "POST", body: form }).catch(
      () => null,
    );
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setJdError(apiErrorText(payload, locale, t("homeJdParseError")));
      return;
    }
    setJdText(payload.text);
    window.sessionStorage.setItem("pivotassist:practiceJd", payload.text);
    window.sessionStorage.setItem(
      "pivotassist:practiceRole",
      file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    );
  };

  const handleCvUpload = async (file: File) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setCvUploading(true);
    setCvMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/resumes", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, t("homeCvFail")));
      const parsed = payload.resume?.parsed ?? {};
      setHasResume(true);
      setResumeName(payload.resume?.filename ?? file.name);
      setResumeMeta({
        fullName: parsed.fullName ?? null,
        title: parsed.currentJobTitle ?? null,
        skills: Array.isArray(parsed.extractedSkills) ? parsed.extractedSkills.slice(0, 8) : [],
      });
      setHomeStats((current) => ({
        ...current,
        atsScore: Array.isArray(parsed.extractedSkills)
          ? parsed.extractedSkills.length
          : current.atsScore,
      }));
      const detail = `${parsed.fullName ? `: ${parsed.fullName}` : ""}${parsed.currentJobTitle ? ` · ${parsed.currentJobTitle}` : ""}`;
      setCvMessage(
        t("homeCvRead", {
          detail,
          engine: payload.parser?.engine ?? "parser",
          chars: payload.parser?.extractedChars ?? 0,
        }),
      );
      if (typeof parsed.fullName === "string" && parsed.fullName.trim()) void refreshUser();
    } catch (error) {
      setCvMessage(error instanceof Error ? error.message : t("homeCvFail"));
    } finally {
      setCvUploading(false);
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto animate-in fade-in duration-300 font-sans pb-16">
      {/* =========================================================================
          1. GREETING & NUMERICAL BENCHMARK CARDS (Antigravity Style)
          ========================================================================= */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(183,191,217,0.14)] text-[#121317] text-[11.5px] font-[450] tracking-normal mb-2">
              <Sparkle size={13} weight="fill" className="text-[#1A73E8]" />
              {t("homeEyebrow")}
            </div>
            <h1 className="font-sans font-[450] text-3xl sm:text-[34px] tracking-normal text-[#121317]">
              {displayName ? `${t("homeWelcome")}, ${displayName}` : t("homeWelcome")}
            </h1>
            <p className="text-[14.5px] text-[#45474D] mt-1 font-normal">{t("homeLead")}</p>
          </div>

          <Link
            href="/interview/setup"
            className="inline-flex items-center gap-2 bg-[#121317] hover:bg-[#2D3139] text-white px-6 py-3 rounded-full font-[450] text-[13.5px] shadow-xs active:scale-[0.98] transition-all cursor-pointer self-start md:self-auto"
          >
            <VideoCamera size={16} weight="fill" />
            {t("homeEnterRoom")}
            <ArrowRight size={14} weight="bold" />
          </Link>
        </div>

        {/* 4 Numerical Benchmark Cards (Antigravity Palette Parity) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SpotlightCard
            className="rounded-[22px] border border-[rgba(33,34,38,0.08)] bg-white p-5 shadow-2xs"
            spotlightColor="rgba(66, 133, 244, 0.08)"
          >
            <div className="flex items-center justify-between text-[#45474D] mb-2">
              <span className="font-sans text-[12px] text-[#45474D]">{t("homeSessions")}</span>
              <VideoCamera size={16} className="text-[#1A73E8]" weight="fill" />
            </div>
            <div className="font-sans font-[450] text-3xl text-[#121317] tracking-normal">
              {homeStats.sessions}
            </div>
            <div className="text-[11.5px] text-[#45474D] mt-1 font-normal">
              {homeStats.sessions > 0 ? t("homeFromApps") : t("homeNoSessions")}
            </div>
          </SpotlightCard>

          <SpotlightCard
            className="rounded-[22px] border border-[rgba(33,34,38,0.08)] bg-white p-5 shadow-2xs"
            spotlightColor="rgba(66, 133, 244, 0.08)"
          >
            <div className="flex items-center justify-between text-[#45474D] mb-2">
              <span className="font-sans text-[12px] text-[#45474D]">{t("homeCompleted")}</span>
              <CheckCircle size={16} className="text-[#1A73E8]" weight="fill" />
            </div>
            <div className="font-sans font-[450] text-3xl text-[#121317] tracking-normal">
              {homeStats.completed}
            </div>
            <div className="text-[11.5px] text-[#45474D] mt-1 font-normal">
              {t("homeReviewsSaved", { count: homeStats.completed })}
            </div>
          </SpotlightCard>

          <SpotlightCard
            className="rounded-[22px] border border-[rgba(33,34,38,0.08)] bg-white p-5 shadow-2xs"
            spotlightColor="rgba(66, 133, 244, 0.08)"
          >
            <div className="flex items-center justify-between text-[#45474D] mb-2">
              <span className="font-sans text-[12px] text-[#45474D]">{t("homeAvg")}</span>
              <UserCheck size={16} className="text-[#1A73E8]" weight="fill" />
            </div>
            <div className="font-sans font-[450] text-3xl text-[#121317] tracking-normal">
              {homeStats.averageScore > 0 ? homeStats.averageScore : "--"}
            </div>
            <div className="text-[11.5px] text-[#45474D] mt-1 font-normal">
              {homeStats.averageScore > 0 ? t("homeFromDone") : t("homeNoScore")}
            </div>
          </SpotlightCard>

          <SpotlightCard
            className="rounded-[22px] border border-[rgba(33,34,38,0.08)] bg-white p-5 shadow-2xs"
            spotlightColor="rgba(66, 133, 244, 0.08)"
          >
            <div className="flex items-center justify-between text-[#45474D] mb-2">
              <span className="font-sans text-[12px] text-[#45474D]">{t("homeSkills")}</span>
              <ChartLineUp size={16} className="text-[#1A73E8]" weight="bold" />
            </div>
            <div className="font-sans font-[450] text-3xl text-[#121317] tracking-normal">
              {homeStats.atsScore > 0 ? homeStats.atsScore : "--"}
            </div>
            <div className="text-[11.5px] text-[#45474D] mt-1 font-normal">
              {t("homeSkillsRead")}
            </div>
          </SpotlightCard>
        </div>
      </div>

      {/* =========================================================================
          2. THE INTERVIEW SIMULATION STUDIO (Central Bento Box)
          ========================================================================= */}
      <div className="rounded-[28px] border border-[rgba(33,34,38,0.08)] bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-8">
        {/* Studio Header & Pill Mode Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[rgba(33,34,38,0.06)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold">
                <VideoCamera size={16} weight="fill" />
              </div>
              <h2 className="font-sans font-[450] text-xl text-[#121317] tracking-normal">
                {t("homeStartCard")}
              </h2>
            </div>
            <p className="text-[13.5px] text-[#45474D] font-normal">{t("interviewDescCv")}</p>
          </div>

          {/* Mode Switcher Pill Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] rounded-[18px] sm:rounded-full self-start md:self-auto max-w-full">
            <button
              onClick={() => setActiveMode("cv")}
              className={cn(
                "px-4 py-1.5 rounded-full text-[12.5px] font-[450] transition-all cursor-pointer",
                activeMode === "cv"
                  ? "bg-[#121317] text-white shadow-xs"
                  : "text-[#45474D] hover:text-[#121317]",
              )}
            >
              {t("homeHasCv")}
            </button>

            <button
              onClick={() => setActiveMode("role")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-[450] transition-all cursor-pointer",
                activeMode === "role"
                  ? "bg-[#121317] text-white shadow-xs"
                  : "text-[#45474D] hover:text-[#121317]",
              )}
            >
              <Briefcase size={14} weight={activeMode === "role" ? "fill" : "regular"} />
              {t("homeModeRole")}
            </button>

            <button
              onClick={() => setActiveMode("speed")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-[450] transition-all cursor-pointer",
                activeMode === "speed"
                  ? "bg-[#121317] text-white shadow-xs"
                  : "text-[#45474D] hover:text-[#121317]",
              )}
            >
              <Lightning size={14} weight={activeMode === "speed" ? "fill" : "regular"} />
              {t("homeModeSpeed")}
            </button>
          </div>
        </div>

        {/* Interactive Workspace Body */}
        <div className="pt-6">
          {activeMode === "cv" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0">
                    <FilePdf size={25} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {hasResume ? (
                      <>
                        <h3 className="font-[450] text-[16px] text-[#121317]">{t("homeHasCv")}</h3>
                        <p className="text-[13px] text-[#45474D] mt-1 truncate">
                          {resumeName ?? t("homeCvDrop")}
                        </p>
                        <p className="text-[12.5px] text-[#45474D] mt-2 leading-relaxed">
                          {resumeMeta.title ?? t("homeNoCv")}
                          {resumeMeta.skills.length > 0
                            ? ` · ${resumeMeta.skills.slice(0, 5).join(", ")}`
                            : ""}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-[450] text-[16px] text-[#121317]">{t("homeNoCv")}</h3>
                        <p className="text-[13px] text-[#45474D] mt-1 leading-relaxed">
                          {t("homeCvHint")}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <p className="text-[12.5px] text-[#45474D] leading-relaxed">
                  {hasResume ? t("interviewDescCv") : t("homeCvHint")}
                </p>
                {hasResume ? (
                  <Link
                    href={`/interview/setup${resumeMeta.title ? `?role=${encodeURIComponent(resumeMeta.title)}` : ""}`}
                    onClick={(event) => {
                      window.sessionStorage.removeItem("pivotassist:practiceJd");
                      window.sessionStorage.removeItem("pivotassist:practiceRole");
                      if (!user) {
                        event.preventDefault();
                        window.location.href = "/login";
                      }
                    }}
                    className="bg-[#121317] hover:bg-[#2D3139] active:scale-[0.98] text-white px-7 py-3 rounded-full font-[450] text-[13.5px] flex items-center justify-center gap-2 shadow-xs transition-all self-stretch sm:self-auto cursor-pointer"
                  >
                    {t("homeStartInterview")} <ArrowRight size={15} weight="bold" />
                  </Link>
                ) : (
                  <Link
                    href="#home-cv"
                    className="bg-[#121317] hover:bg-[#2D3139] text-white px-7 py-3 rounded-full font-[450] text-[13.5px] flex items-center justify-center gap-2 shadow-xs transition-all self-stretch sm:self-auto"
                  >
                    {t("homeUpdateCv")} <ArrowRight size={15} weight="bold" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {activeMode === "jd" && (
            <div className="space-y-6">
              {/* PDF Upload Dropzone with HTML5 Drag & Drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingJd(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingJd(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingJd(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    void handleJdFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => jdFileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center text-center",
                  isDraggingJd
                    ? "border-[#1A73E8] bg-[#E8F0FE]/40 scale-[1.008]"
                    : "border-[rgba(33,34,38,0.18)] hover:border-[#1A73E8] bg-[#F8F9FA]/60 hover:bg-[#E8F0FE]/20",
                )}
              >
                <input
                  ref={jdFileInputRef}
                  type="file"
                  accept=".pdf,.docx,.md,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      void handleJdFile(e.target.files[0]);
                    }
                  }}
                />

                {jdFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
                      <CheckCircle size={24} weight="fill" />
                    </div>
                    <div className="font-sans font-[450] text-[15px] text-[#121317]">
                      {t("homeJdLoaded")} <strong className="text-[#1A73E8]">{jdFile.name}</strong>{" "}
                      ({jdFile.size})
                    </div>
                    <p className="text-[12.5px] text-[#137333]">✓ {t("homeJdReady")}</p>
                    <span className="inline-block text-[11.5px] text-[#45474D] underline hover:text-[#121317] mt-1">
                      {t("homeJdOther")}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white border border-[rgba(33,34,38,0.08)] rounded-2xl flex items-center justify-center mb-3 text-[#1A73E8] shadow-2xs group-hover:scale-105 transition-transform">
                      <Briefcase size={24} weight="fill" />
                    </div>
                    <div className="font-sans font-[450] text-[15px] text-[#121317] mb-1">
                      {isDraggingJd ? t("homeJdDragging") : t("homeJdDrop")}
                    </div>
                    <p className="text-[13px] text-[#45474D] max-w-md mb-4 leading-relaxed font-normal">
                      {t("homeJdHint")}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="bg-white border border-[rgba(33,34,38,0.12)] px-4 py-2 rounded-full text-[13px] font-[450] text-[#121317] shadow-2xs hover:bg-[#121317] hover:text-white transition-all">
                        {t("homeJdPick")}
                      </span>
                      <span className="text-[11.5px] text-[#45474D]">{t("homeJdMax")}</span>
                    </div>
                  </>
                )}
              </div>
              <p className="text-[12.5px] text-[#45474D] leading-relaxed">
                {t("homeJdNotCv")}{" "}
                <a href="#home-cv" className="font-[450] text-[#1A73E8] hover:underline">
                  {t("homeJdGoCv")}
                </a>
              </p>
              {jdResumeFile ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl border border-[#FEEFC3] bg-[#FEF7E0] px-4 py-3">
                  <p className="text-[13px] text-[#8A4B08] flex-1">{t("homeJdSaveAsCv")}</p>
                  <button
                    type="button"
                    disabled={cvUploading}
                    onClick={() => {
                      void handleCvUpload(jdResumeFile);
                      setJdResumeFile(null);
                    }}
                    className="text-[12.5px] font-[450] px-3 py-1.5 rounded-full bg-[#121317] text-white disabled:opacity-60"
                  >
                    {t("homeJdSaveAsCvCta")}
                  </button>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <p className="text-[12.5px] text-[#45474D] leading-relaxed">
                  {t("homePracticeHint")}
                </p>
                <Link
                  href={
                    jdText
                      ? `/interview/setup?role=${encodeURIComponent(jdFile?.name.replace(/\.[^.]+$/, "") ?? (locale === "en" ? "Practice role" : "Vị trí luyện"))}`
                      : "/interview/setup"
                  }
                  onClick={(event) => {
                    if (jdText) {
                      window.sessionStorage.setItem("pivotassist:practiceJd", jdText);
                    }
                    if (!user) {
                      event.preventDefault();
                      window.location.href = "/login";
                    }
                  }}
                  className="bg-[#121317] hover:bg-[#2D3139] active:scale-[0.98] text-white px-7 py-3 rounded-full font-[450] text-[13.5px] flex items-center justify-center gap-2 shadow-xs transition-all self-stretch sm:self-auto cursor-pointer"
                >
                  {t("homeStartInterview")} <ArrowRight size={15} weight="bold" />
                </Link>
              </div>
              {jdError && (
                <div className="mt-2 text-[12px] text-[#C5221F]" role="alert">
                  {jdError}
                </div>
              )}
            </div>
          )}

          {activeMode === "role" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { title: t("homeRoleFe"), desc: t("homeRoleFeDesc") },
                { title: t("homeRoleBe"), desc: t("homeRoleBeDesc") },
                { title: t("homeRoleDa"), desc: t("homeRoleDaDesc") },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={`/interview/setup?role=${encodeURIComponent(item.title)}`}
                  className="p-5 rounded-2xl border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] hover:border-[#1A73E8] hover:bg-white transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="font-sans font-[450] text-[15px] text-[#121317] group-hover:text-[#1A73E8] transition-colors mb-1">
                      {item.title}
                    </div>
                    <div className="text-[12.5px] text-[#45474D] leading-relaxed mb-4 font-normal">
                      {item.desc}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px] font-[450] text-[#1A73E8] pt-3 border-t border-[rgba(33,34,38,0.06)]">
                    <span>{t("homeRoleCta")}</span>
                    <CaretRight size={14} />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {activeMode === "speed" && (
            <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] rounded-2xl p-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center mb-3">
                <Microphone size={24} weight="fill" />
              </div>
              <h4 className="font-sans font-[450] text-[#121317] text-lg mb-1">
                {t("homeSpeedTitle")}
              </h4>
              <p className="text-[13.5px] text-[#45474D] max-w-md mb-6 leading-relaxed font-normal">
                {t("homeSpeedLead")}
              </p>
              <Link
                href="/interview/setup?mode=speed"
                className="bg-[#121317] hover:bg-[#2D3139] text-white px-7 py-3 rounded-full font-[450] text-[13.5px] flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                {t("homeSpeedCta")} <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          3. LOWER BENTO GRID: 3 WORKSPACE CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        <div
          id="home-cv"
          className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-w-0"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 font-[450] text-[15px] text-[#121317] min-w-0">
                <FilePdf size={18} className="text-[#1A73E8] shrink-0" weight="fill" />
                <span className="truncate">{t("homeYourProfile")}</span>
              </div>
              <span
                className={cn(
                  "text-[11px] font-[450] px-2.5 py-0.5 rounded-full shrink-0",
                  hasResume ? "text-[#137333] bg-[#E6F4EA]" : "text-[#EA4335] bg-[#FCE8E6]",
                )}
              >
                {hasResume ? t("homeHasCv") : t("homeNoCv")}
              </span>
            </div>

            <input
              ref={cvInputRef}
              type="file"
              className="hidden"
              accept={SUPPORTED_RESUME_ACCEPT}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleCvUpload(file);
                event.target.value = "";
              }}
            />

            {hasResume ? (
              <div className="rounded-2xl border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-4 mb-4">
                <div className="font-[450] text-[15px] text-[#121317] truncate">
                  {resumeMeta.fullName || t("homeCvReady")}
                </div>
                {resumeMeta.title ? (
                  <div className="text-[12.5px] text-[#45474D] mt-0.5 truncate">
                    {resumeMeta.title}
                  </div>
                ) : null}
                {resumeName ? (
                  <div className="text-[11.5px] text-[#5F6368] mt-1 truncate">{resumeName}</div>
                ) : null}
                {resumeMeta.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {resumeMeta.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-[rgba(33,34,38,0.08)] text-[#121317]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                disabled={cvUploading}
                onClick={() => cvInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) void handleCvUpload(file);
                }}
                className="w-full border border-dashed border-[rgba(33,34,38,0.16)] rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-[#1A73E8] hover:bg-[#E8F0FE]/20 transition-all cursor-pointer group mb-4 disabled:opacity-60"
              >
                <div className="w-10 h-10 bg-[#E8F0FE] text-[#1A73E8] rounded-full flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                  <UploadSimple size={18} weight="bold" />
                </div>
                <div className="font-[450] text-[13.5px] text-[#121317] mb-0.5">
                  {cvUploading ? t("homeReadingCv") : t("homeCvDrop")}
                </div>
                <div className="text-[12px] text-[#45474D]">{t("homeCvHint")}</div>
              </button>
            )}

            {cvMessage ? <p className="text-[12.5px] text-[#137333] mb-3">{cvMessage}</p> : null}
            {hasResume ? (
              <p className="text-[12px] text-[#45474D] leading-relaxed mb-3">
                {t("homeCvReplace")}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {hasResume ? (
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  className="text-[12px] font-[450] px-3 py-1.5 rounded-full border border-[rgba(33,34,38,0.1)] hover:bg-[#F8F9FA]"
                >
                  {t("homeUpdateCv")}
                </button>
              ) : null}
              <Link
                href="/profiles"
                className="text-[12px] font-[450] px-3 py-1.5 rounded-full bg-[#121317] text-white"
              >
                {t("homeProfileLink")}
              </Link>
              <Link
                href="/interview/setup"
                className="text-[12px] font-[450] px-3 py-1.5 rounded-full bg-[#E8F0FE] text-[#1A73E8]"
              >
                {t("homePracticeLink")}
              </Link>
              <Link
                href="/jobs"
                className="text-[12px] font-[450] px-3 py-1.5 rounded-full bg-[#F1F3F4] text-[#121317]"
              >
                {t("homeFindJobs")}
              </Link>
            </div>
          </div>

          <div className="text-[12px] text-[#45474D] flex items-center gap-1.5 pt-3 border-t border-[rgba(33,34,38,0.06)] font-normal mt-4">
            <ShieldCheck size={16} className="text-[#1A73E8] shrink-0" weight="fill" />
            {t("homeCvPrivacy")}
          </div>
        </div>

        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 font-[450] text-[15px] text-[#121317]">
                <Briefcase size={18} className="text-[#1A73E8]" weight="fill" />
                {t("homeOpenRoles")}
              </div>
            </div>
            <p className="text-[12px] text-[#45474D] mb-3.5 font-normal leading-relaxed">
              {t("homeOpenRolesLead")}
            </p>

            <div className="flex flex-col gap-2.5">
              {(!jobsReady
                ? [{ id: "", title: t("homeJobsLoading"), company: t("homeCompany"), loc: "—" }]
                : featuredJobs.length > 0
                  ? featuredJobs
                  : [{ id: "", title: t("homeNoJobs"), company: t("homeCompany"), loc: "—" }]
              ).map((job) => (
                <Link
                  key={job.id || job.title}
                  href={job.id ? `/jobs?jobId=${encodeURIComponent(job.id)}` : "/jobs"}
                  className="p-3 bg-[#F8F9FA] hover:bg-white rounded-xl border border-[rgba(33,34,38,0.06)] hover:border-[rgba(33,34,38,0.16)] transition-all cursor-pointer group flex items-center justify-between gap-2 min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[rgba(33,34,38,0.08)] flex items-center justify-center font-[450] text-[12px] text-[#121317] shrink-0 shadow-2xs">
                      <BuildingOffice size={16} className="text-[#45474D]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-[450] text-[13px] text-[#121317] group-hover:text-[#1A73E8] transition-colors truncate">
                        {job.title}
                      </div>
                      <div className="text-[11.5px] text-[#45474D] font-normal truncate">
                        {job.company} · {job.loc}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11.5px] font-[450] text-[#121317] bg-[#F1F3F4] group-hover:bg-[#121317] group-hover:text-white px-3 py-1 rounded-full shrink-0 transition-colors">
                    {t("homeViewJob")}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/jobs"
            className="pt-3 border-t border-[rgba(33,34,38,0.06)] flex items-center justify-between text-[12px] text-[#1A73E8] font-[450] mt-4"
          >
            <span>{t("homeViewAllJobs")}</span>
            <span>{t("homePositions", { count: jobsTotal || featuredJobs.length })}</span>
          </Link>
        </div>

        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-w-0 md:col-span-2 xl:col-span-1">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-[450] text-[15px] text-[#121317]">
                <FolderOpen size={18} className="text-[#1A73E8]" weight="fill" />
                {t("homeRecent")}
              </div>
            </div>

            {recentApplications.length === 0 ? (
              <div className="p-6 bg-[#F8F9FA] rounded-2xl border border-[rgba(33,34,38,0.06)] flex flex-col items-center justify-center text-center min-h-[160px]">
                <div className="w-10 h-10 rounded-full bg-white border border-[rgba(33,34,38,0.08)] flex items-center justify-center mb-2.5 text-[#45474D] shadow-2xs">
                  <FolderOpen size={18} />
                </div>
                <div className="font-[450] text-[#121317] text-[13.5px] mb-1">
                  {t("homeNoHistory")}
                </div>
                <p className="text-[12px] text-[#45474D] max-w-[220px] leading-relaxed font-normal">
                  {t("homeNoHistoryLead")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recentApplications.map((application) => (
                  <Link
                    key={application.id}
                    href={
                      application.interviewId
                        ? `/interview/report/${application.interviewId}`
                        : "/applications"
                    }
                    className="p-3 rounded-xl border border-[rgba(33,34,38,0.08)] hover:border-[#1A73E8] bg-[#F8F9FA] hover:bg-white transition-all min-w-0"
                  >
                    <div className="text-[13px] font-[450] text-[#121317] truncate">
                      {application.title}
                    </div>
                    <div className="text-[11.5px] text-[#45474D] mt-0.5">{application.status}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[rgba(33,34,38,0.06)] text-[12px] text-[#45474D] flex items-center justify-between mt-4">
            <span>{t("homeLastTime")}:</span>
            <span className="font-[450] text-[#121317]">
              {recentApplications[0]?.status ?? "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
