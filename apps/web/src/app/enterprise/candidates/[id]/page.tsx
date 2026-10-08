"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Check,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  FilePdf,
  FileText,
  NotePencil,
  Phone,
  Sparkle,
  Star,
  UserCircle,
} from "@phosphor-icons/react";
import { EnterpriseAppShell } from "@/components/EnterpriseAppShell";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { type EnterpriseApplication, type EnterpriseJob } from "@/data/enterprise-data";
import { useLocale } from "@/lib/i18n";
import {
  enterpriseDateLabel,
  enterpriseDetailCopy,
  enterpriseDurationLabel,
  enterpriseNextActionLabel,
  enterpriseResumeFallback,
  enterpriseRoleFallback,
  enterpriseSignalLabel,
  fillCopy,
} from "@/lib/i18n-enterprise";
import { applicationStatusLabel } from "@/lib/ui-copy";
import { apiErrorText } from "@/lib/api-errors";
import { useRealtime } from "@/lib/useRealtime";
import { EnterpriseReviewWorkspace } from "@/components/EnterpriseReviewWorkspace";

function toLocalDateTimeInput(value?: string | null): string {
  const date = value ? new Date(value) : new Date(Date.now() + 48 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: "bg-[#F8F9FA] text-ink-soft border-mist",
  AI_INTERVIEW_PENDING: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  AI_INTERVIEW_IN_PROGRESS: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  AI_INTERVIEW_COMPLETED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  SHORTLISTED: "bg-[#E8F0FE] text-[#185ABC] border-[#D2E3FC]",
  FACE_TO_FACE_SCHEDULED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  HOLD: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  ADDITIONAL_ASSESSMENT: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  OFFER_PENDING: "bg-[#E8F0FE] text-[#185ABC] border-[#D2E3FC]",
  HIRED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  REJECTED: "bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]",
};

export default function EnterpriseCandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const applicationId = typeof params?.id === "string" ? params.id : "";
  const { user, isLoading: isUserLoading } = useUser();
  const { locale } = useLocale();
  const copy = enterpriseDetailCopy(locale);
  const [application, setApplication] = useState<EnterpriseApplication | null>(null);
  const [job, setJob] = useState<(EnterpriseJob & { companyName?: string }) | null>(null);
  const [dataSource, setDataSource] = useState<"empty" | "live" | "loading" | "error">("loading");
  const [status, setStatus] = useState<EnterpriseApplication["status"]>("SUBMITTED");
  const [internalNote, setInternalNote] = useState("");
  const [isNoteSaved, setIsNoteSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    scheduledAt: toLocalDateTimeInput(),
    interviewerName: "",
    meetingUrl: "",
    notes: "",
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [reportScores, setReportScores] = useState<
    Array<{ label: string; score: number; weight: number }>
  >([]);
  const [aiSupport, setAiSupport] = useState<{
    recommendation?: string | null;
    summaryText?: string | null;
  }>({});
  const [reviews, setReviews] = useState<
    Array<{
      id: string;
      reviewerId: string;
      reviewerName?: string | null;
      status: string;
      comment?: string | null;
      hiddenUntilYouSubmit?: boolean;
    }>
  >([]);
  const [offer, setOffer] = useState<null | {
    id: string;
    status: string;
    title: string;
    compensationAmount: number;
    currency: string;
    employmentType: string;
    location: string | null;
    startDate: string | null;
    benefits: string | null;
    terms: string | null;
    expiresAt: string | null;
  }>(null);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "pipeline" || event.type === "notification")
      setLiveTick((current) => current + 1);
  });

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || !["RECRUITER", "ADMIN"].includes(user.role) || !applicationId) {
      setDataSource("empty");
      setNotice(!applicationId ? copy.needId : copy.needRole);
      return;
    }
    let cancelled = false;
    async function loadLiveApplication() {
      try {
        const response = await fetch(
          `/api/enterprise/applications/${encodeURIComponent(applicationId)}`,
          { cache: "no-store" },
        );
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success)
          throw new Error(apiErrorText(payload, locale, copy.loadAppFail));
        const jobResponse = await fetch(
          `/api/enterprise/jobs/${encodeURIComponent(payload.jobId)}`,
          { cache: "no-store" },
        );
        const jobPayload = await jobResponse.json().catch(() => null);
        if (!jobResponse.ok || !jobPayload?.success)
          throw new Error(apiErrorText(jobPayload, locale, copy.loadJobFail));
        if (cancelled) return;
        setApplication(payload.application);
        setStatus(payload.application.status);
        setJob(jobPayload.job);
        setReviews(payload.reviews ?? []);
        setOffer(payload.offer ?? null);
        setDataSource("live");
        const [notesResponse, scheduleResponse] = await Promise.all([
          fetch(`/api/enterprise/applications/${encodeURIComponent(applicationId)}/notes`, {
            cache: "no-store",
          }).catch(() => null),
          fetch(`/api/enterprise/applications/${encodeURIComponent(applicationId)}/schedule`, {
            cache: "no-store",
          }).catch(() => null),
        ]);
        const notesPayload = await notesResponse?.json().catch(() => null);
        const schedulePayload = await scheduleResponse?.json().catch(() => null);
        if (!cancelled && notesPayload?.success)
          setInternalNote(notesPayload.notes?.[0]?.body ?? "");
        const latestSchedule = schedulePayload?.success
          ? ([...(schedulePayload.schedules ?? [])]
              .filter(
                (item: { status?: string; scheduledAt?: string }) => item.status !== "CANCELLED",
              )
              .sort(
                (a: { scheduledAt?: string }, b: { scheduledAt?: string }) =>
                  new Date(b.scheduledAt ?? 0).getTime() - new Date(a.scheduledAt ?? 0).getTime(),
              )[0] ?? schedulePayload.schedules?.[0])
          : null;
        if (!cancelled && latestSchedule) {
          setScheduleAt(latestSchedule.scheduledAt ?? null);
          setScheduleId(latestSchedule.id ?? null);
          setScheduleForm({
            scheduledAt: toLocalDateTimeInput(latestSchedule.scheduledAt),
            interviewerName: latestSchedule.interviewerName ?? "",
            meetingUrl: latestSchedule.meetingUrl ?? "",
            notes: latestSchedule.notes ?? "",
          });
        }
        if (payload.application.interviewId) {
          const reportResponse = await fetch(
            `/api/interviews/${encodeURIComponent(payload.application.interviewId)}/report`,
            { cache: "no-store" },
          ).catch(() => null);
          const reportPayload = await reportResponse?.json().catch(() => null);
          const questions = reportPayload?.report?.questions ?? [];
          const rubric = jobPayload.job?.rubric ?? [];
          if (!cancelled) {
            setAiSupport({
              recommendation:
                reportPayload?.report?.recommendation ??
                reportPayload?.report?.score?.recommendation ??
                null,
              summaryText: reportPayload?.report?.summaryText ?? null,
            });
            setReportScores(
              rubric.map((item: { label: string; weight: number }, index: number) => ({
                label: item.label,
                weight: item.weight,
                score:
                  typeof questions[index]?.technicalScore === "number"
                    ? questions[index].technicalScore
                    : (payload.application.interviewScore ?? 0),
              })),
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setApplication(null);
          setJob(null);
          setDataSource("error");
          setNotice(error instanceof Error ? error.message : copy.loadAppFail);
        }
      }
    }
    void loadLiveApplication();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, isUserLoading, user, liveTick]);

  if (!application || !job) {
    return (
      <EnterpriseAppShell>
        <div className="max-w-[760px] mx-auto py-16 text-center">
          <div className="bg-white border border-mist rounded-2xl p-10 shadow-2xs">
            <h1 className="text-xl font-bold text-ink">
              {dataSource === "loading" ? copy.loadApp : copy.missingApp}
            </h1>
            <p className="text-[13px] text-ink-soft mt-2">
              {dataSource === "loading" ? copy.loadAppLead : (notice ?? copy.missingAppLead)}
            </p>
            <Link
              href="/enterprise/dashboard"
              className="inline-flex items-center gap-2 mt-5 text-[12.5px] font-bold text-accent-deep"
            >
              {copy.backPipeline} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </EnterpriseAppShell>
    );
  }

  const score = application.interviewScore ?? 0;
  const evaluationRows =
    reportScores.length > 0
      ? reportScores
      : (job.rubric ?? []).map((item) => ({ label: item.label, score, weight: item.weight }));

  const handleAdvance = async () => {
    if (status !== "AI_INTERVIEW_COMPLETED") {
      setNotice(status === "SHORTLISTED" ? copy.roomNeedTime : copy.alreadyRoom);
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
        throw new Error(apiErrorText(payload, locale, copy.updateAppFail));
      if (payload.application) setApplication(payload.application);
      setStatus("SHORTLISTED");
      setNotice(fillCopy(copy.shortlisted, { name: application.candidateName }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.updateFail);
    }
  };

  const handleSaveSchedule = async () => {
    if (dataSource !== "live") {
      setNotice(copy.needSync);
      return;
    }
    if (status !== "SHORTLISTED" && status !== "FACE_TO_FACE_SCHEDULED") {
      setNotice(copy.roomNeedShort);
      return;
    }
    const scheduledDate = new Date(scheduleForm.scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      setNotice(copy.invalidTime);
      return;
    }
    setIsScheduling(true);
    try {
      const body = {
        scheduledAt: scheduledDate.toISOString(),
        timezone: "Asia/Ho_Chi_Minh",
        interviewerName: scheduleForm.interviewerName.trim() || null,
        meetingUrl: scheduleForm.meetingUrl.trim() || null,
        notes: scheduleForm.notes.trim() || null,
      };
      const response = scheduleId
        ? await fetch(
            `/api/enterprise/applications/${encodeURIComponent(application.id)}/schedule/${encodeURIComponent(scheduleId)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          )
        : await fetch(
            `/api/enterprise/applications/${encodeURIComponent(application.id)}/schedule`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, copy.roomFail));
      const saved = payload.schedule;
      setScheduleId(saved?.id ?? scheduleId);
      setScheduleAt(saved?.scheduledAt ?? scheduledDate.toISOString());
      setStatus("FACE_TO_FACE_SCHEDULED");
      setApplication((current) =>
        current ? { ...current, status: "FACE_TO_FACE_SCHEDULED" } : current,
      );
      setNotice(
        fillCopy(copy.roomMade, {
          name: application.candidateName,
          when: scheduledDate.toLocaleString(locale === "en" ? "en-GB" : "vi-VN"),
        }),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.roomFail);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSaveNote = async () => {
    if (dataSource !== "live") {
      setNotice(copy.noteNeedSync);
      return;
    }
    const response = await fetch(
      `/api/enterprise/applications/${encodeURIComponent(application.id)}/notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: internalNote }),
      },
    ).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setNotice(apiErrorText(payload, locale, copy.noteFail));
      return;
    }
    setIsNoteSaved(true);
    setNotice(copy.noteOk);
    window.setTimeout(() => setIsNoteSaved(false), 2000);
  };

  const actionLabel =
    status === "AI_INTERVIEW_COMPLETED"
      ? copy.stepShort
      : status === "SHORTLISTED"
        ? copy.createRoom
        : copy.already;

  return (
    <EnterpriseAppShell>
      <div className="max-w-[1240px] mx-auto animate-in fade-in duration-300 space-y-6 pb-20 min-w-0 overflow-x-hidden">
        <header className="border-b border-mist pb-5">
          <Link
            href={`/enterprise/jobs/${job.id}?tab=applicants`}
            className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-ink transition-colors mb-4"
          >
            <ArrowLeft size={14} weight="bold" /> {copy.backList}
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-ink-soft uppercase tracking-wider">
                <span className="text-accent-deep">{copy.detail}</span>
                <span>•</span>
                <span>{enterpriseDateLabel(application.submittedAt, locale)}</span>
                <span>•</span>
                <span>{dataSource === "live" ? copy.live : copy.offline}</span>
              </div>
              <div className="flex items-center gap-3 mt-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-ink text-white flex items-center justify-center font-bold text-[14px] shrink-0">
                  {application.initials}
                </div>
                <div className="min-w-0">
                  <h1 className="text-[27px] sm:text-[32px] font-[450] text-ink tracking-[-0.03em] break-words">
                    {application.candidateName}
                  </h1>
                  <p className="text-[13px] text-ink-soft mt-0.5 break-words">
                    {enterpriseRoleFallback(application.candidateRole, locale)} · {copy.applied}{" "}
                    <span className="text-ink font-semibold">{job.title}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (dataSource === "live")
                    window.open(
                      `/api/enterprise/applications/${encodeURIComponent(application.id)}/resume`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  else setNotice(copy.previewCv);
                }}
                className="inline-flex items-center gap-1.5 border border-mist-dark hover:border-ink px-3.5 py-2 rounded-xl text-[12px] font-bold text-ink transition-all"
              >
                <FilePdf size={15} /> {copy.openCv}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (status === "SHORTLISTED" || status === "FACE_TO_FACE_SCHEDULED")
                    document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth" });
                  else void handleAdvance();
                }}
                className="inline-flex items-center gap-1.5 bg-accent-deep hover:bg-accent-hover text-white px-3.5 py-2 rounded-xl text-[12px] font-bold shadow-xs transition-all"
              >
                {actionLabel}
                <ArrowRight size={14} />
              </button>
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

        {application.interviewRecording ? (
          <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs mb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-accent-deep">
                  Video phỏng vấn do ứng viên gửi
                </div>
                <h2 className="text-[18px] font-bold text-ink mt-2">Recording đã được chia sẻ</h2>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold">Được phép xem</span>
            </div>
            <video
              controls
              preload="metadata"
              className="w-full rounded-xl bg-black max-h-[560px] mt-4"
              src={application.interviewRecording.playbackUrl}
            />
            <p className="text-[11.5px] text-ink-soft mt-2">
              {application.interviewRecording.filename} · Ứng viên đã chủ động gửi video cho doanh
              nghiệp.
            </p>
          </section>
        ) : null}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              Recording
            </div>
            <div className="text-[18px] font-[450] text-accent-deep mt-2">
              {application.interviewRecording ? "Đã gửi" : "Chưa gửi"}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">
              Recruiter xem video và transcript, không dùng điểm tổng hợp.
            </div>
          </div>
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              {copy.cvMatch}
            </div>
            <div className="text-[25px] font-[450] text-ink mt-1 font-mono">
              {typeof application.cvMatch === "number" ? application.cvMatch : "—"}
              <span className="text-[13px] text-ink-soft">
                {typeof application.cvMatch === "number" ? "%" : ""}
              </span>
            </div>
            <div className="text-[11px] text-ink-soft mt-0.5">{copy.cvMatchHint}</div>
          </div>
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              {copy.duration}
            </div>
            <div className="text-[18px] font-[450] text-ink mt-2 font-mono">
              {enterpriseDurationLabel(application.interviewDuration, locale) || "—"}
            </div>
            <div className="text-[11px] text-ink-soft mt-1">{copy.durationHint}</div>
          </div>
          <div className="bg-white border border-mist rounded-2xl p-4 shadow-2xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-soft">
              {copy.status}
            </div>
            <div className="mt-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  STATUS_TONE[status] ?? "bg-paper-dim text-ink-soft border-mist",
                )}
              >
                {status === "FACE_TO_FACE_SCHEDULED" ? (
                  <CalendarBlank size={13} />
                ) : (
                  <CheckCircle size={13} weight="fill" />
                )}
                {applicationStatusLabel(status, locale)}
              </span>
            </div>
            <div className="text-[11px] text-ink-soft mt-1">
              {enterpriseNextActionLabel(application.nextAction, locale)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(290px,0.75fr)] gap-5 items-start">
          <main className="space-y-5">
            <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-mist pb-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-accent-deep">
                    <Sparkle size={14} weight="fill" /> {copy.rubricEyebrow}
                  </div>
                  <h2 className="text-[18px] font-bold text-ink mt-2">
                    {fillCopy(copy.rubricTitle, { title: job.title })}
                  </h2>
                  <p className="text-[12px] text-ink-soft mt-1">{copy.rubricLead}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 font-bold">
                  <Star size={15} weight="fill" /> {score}/100
                </div>
              </div>
              <div className="space-y-4 mt-5">
                {evaluationRows.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="font-bold text-ink">{item.label}</span>
                      <span className="font-mono text-ink-soft">
                        {item.score}/100 · {item.weight}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-paper-dim overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full bg-accent-deep"
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-mist">
                <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                  <Sparkle size={15} weight="fill" className="text-accent-deep" /> {copy.signal}
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed mt-2">
                  {enterpriseSignalLabel(application.interviewScore, locale)}
                </p>
              </div>
            </section>

            {[
              "AI_INTERVIEW_COMPLETED",
              "HOLD",
              "ADDITIONAL_ASSESSMENT",
              "SHORTLISTED",
              "FACE_TO_FACE_SCHEDULED",
              "OFFER_PENDING",
              "HIRED",
              "REJECTED",
            ].includes(status) ? (
              <EnterpriseReviewWorkspace
                locale={locale}
                applicationId={application.id}
                candidateName={application.candidateName}
                status={status}
                interviewId={application.interviewId}
                recommendation={aiSupport.recommendation}
                summaryText={aiSupport.summaryText}
                initialReviews={reviews}
                initialOffer={offer}
                onStatus={(next) => setStatus(next as EnterpriseApplication["status"])}
                onNotice={setNotice}
              />
            ) : null}

            <section className="bg-white border border-mist rounded-2xl p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                <Clock size={17} className="text-accent-deep" /> {copy.timeline}
              </div>
              <div className="space-y-4 mt-5 ml-1">
                {[
                  [
                    copy.stepSubmit,
                    `CV ${enterpriseResumeFallback(application.resumeName, locale)}`,
                    enterpriseDateLabel(application.submittedAt, locale),
                    true,
                  ],
                  [
                    copy.stepAi,
                    application.interviewScore
                      ? `${application.interviewScore}/100 · ${enterpriseDurationLabel(application.interviewDuration, locale)}`
                      : copy.notDone,
                    application.completedAt
                      ? enterpriseDateLabel(application.completedAt, locale)
                      : copy.waiting,
                    Boolean(application.interviewScore),
                  ],
                  [
                    copy.stepShort,
                    status === "AI_INTERVIEW_COMPLETED" ? copy.notMoved : copy.recruiterCall,
                    status === "AI_INTERVIEW_COMPLETED" ? copy.next : copy.updated,
                    status !== "AI_INTERVIEW_COMPLETED",
                  ],
                  [
                    copy.stepRoom,
                    status === "FACE_TO_FACE_SCHEDULED"
                      ? `${copy.booked} · ${scheduleAt ? new Date(scheduleAt).toLocaleString(locale === "en" ? "en-GB" : "vi-VN") : copy.live}`
                      : copy.notScheduled,
                    status === "FACE_TO_FACE_SCHEDULED" ? copy.booked : copy.afterShort,
                    status === "FACE_TO_FACE_SCHEDULED",
                  ],
                ].map(([label, detail, time, done], index) => (
                  <div key={String(label)} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                        done
                          ? "bg-accent-deep/10 border-accent-deep/20 text-accent-deep"
                          : "bg-paper-dim border-mist text-ink-soft",
                      )}
                    >
                      {done ? (
                        <Check size={14} weight="bold" />
                      ) : (
                        <span className="text-[10px] font-mono">0{index + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-ink">{label}</div>
                      <div className="text-[12px] text-ink-soft mt-0.5">{detail}</div>
                      <div className="text-[10.5px] font-mono text-ink-soft/70 mt-1">{time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="bg-white border border-mist rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                <UserCircle size={18} className="text-accent-deep" /> {copy.person}
              </div>
              <div className="space-y-3 mt-4 text-[12.5px]">
                <div className="flex items-center gap-2 text-ink-soft">
                  <EnvelopeSimple size={15} />
                  <span>{application.candidateEmail ?? copy.noEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-soft">
                  <Phone size={15} />
                  <span>{application.candidatePhone ?? copy.noPhone}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-soft">
                  <FileText size={15} />
                  <span>{enterpriseResumeFallback(application.resumeName, locale)}</span>
                </div>
              </div>
              {application.cvSummary ? (
                <p className="mt-4 text-[12.5px] text-ink-soft leading-relaxed whitespace-pre-wrap">
                  {application.cvSummary}
                </p>
              ) : null}
              {application.cvSkills && application.cvSkills.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {application.cvSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-mist bg-paper-dim px-2 py-0.5 text-[11px] text-ink"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (dataSource === "live")
                    window.open(
                      `/api/enterprise/applications/${encodeURIComponent(application.id)}/resume`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                }}
                className="w-full mt-5 inline-flex items-center justify-center gap-1.5 border border-mist-dark hover:border-ink rounded-xl px-3 py-2 text-[12px] font-bold text-ink transition-all"
              >
                <FilePdf size={15} /> {copy.viewCv}
              </button>
            </section>
            <section
              id="schedule"
              className="bg-white border border-mist rounded-2xl p-5 shadow-2xs"
            >
              <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                <CalendarBlank size={17} className="text-accent-deep" /> {copy.roomTitle}
              </div>
              <p className="text-[12px] text-ink-soft mt-1">{copy.roomLead}</p>
              {status !== "SHORTLISTED" && status !== "FACE_TO_FACE_SCHEDULED" ? (
                <p className="mt-3 text-[12.5px] text-ink-soft">{copy.roomNeedShort}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                    {copy.when}
                    <input
                      type="datetime-local"
                      value={scheduleForm.scheduledAt}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          scheduledAt: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                    {copy.interviewer}
                    <input
                      value={scheduleForm.interviewerName}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          interviewerName: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                    {copy.meetUrl}
                    <input
                      type="url"
                      value={scheduleForm.meetingUrl}
                      onChange={(event) =>
                        setScheduleForm((current) => ({
                          ...current,
                          meetingUrl: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
                    />
                  </label>
                  <label className="block text-[11px] font-bold text-ink-soft uppercase tracking-wider">
                    {copy.notes}
                    <textarea
                      value={scheduleForm.notes}
                      onChange={(event) =>
                        setScheduleForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-mist-dark bg-paper-dim px-3 py-2 text-[13px] text-ink"
                    />
                  </label>
                  <p className="text-[11.5px] text-ink-soft">{copy.meetHint}</p>
                  <button
                    type="button"
                    disabled={isScheduling}
                    onClick={() => void handleSaveSchedule()}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-accent-deep hover:bg-accent-hover text-white rounded-xl px-3 py-2.5 text-[12px] font-bold disabled:opacity-60"
                  >
                    {isScheduling ? copy.saving : scheduleId ? copy.updateRoom : copy.createRoom}
                  </button>
                  {scheduleId ? (
                    <Link
                      href={`/face-to-face/${encodeURIComponent(scheduleId)}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 border border-mist-dark rounded-xl px-3 py-2.5 text-[12px] font-bold text-ink"
                    >
                      {copy.enterRoom}
                    </Link>
                  ) : null}
                  {scheduleAt ? (
                    <p className="text-[11.5px] text-emerald-700">
                      {copy.savedAt}{" "}
                      {new Date(scheduleAt).toLocaleString(locale === "en" ? "en-GB" : "vi-VN")}
                    </p>
                  ) : null}
                </div>
              )}
            </section>
            <section className="bg-white border border-mist rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
                  <NotePencil size={17} className="text-accent-deep" /> {copy.noteTitle}
                </div>
                {isNoteSaved && (
                  <span className="text-[10.5px] text-emerald-700 font-bold">{copy.noteSaved}</span>
                )}
              </div>
              <textarea
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
                rows={6}
                className="w-full mt-4 rounded-xl border border-mist-dark bg-paper-dim px-3 py-2.5 text-[12.5px] text-ink leading-relaxed focus:outline-none focus:border-accent-deep"
                aria-label={copy.noteTitle}
              />
              <button
                type="button"
                onClick={handleSaveNote}
                className="w-full mt-3 inline-flex items-center justify-center gap-1.5 bg-ink hover:bg-ink-soft text-white rounded-xl px-3 py-2.5 text-[12px] font-bold transition-all"
              >
                <Check size={14} weight="bold" /> {copy.saveNote}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </EnterpriseAppShell>
  );
}
