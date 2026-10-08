"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Clock,
  FileText,
  Sparkle,
  VideoCamera,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import {
  applicationStatusHelp,
  applicationStatusLabel,
  candidateFacingHelp,
  candidateFacingLabel,
} from "@/lib/ui-copy";
import { fromServerApplication, type CandidateApplicationRecord } from "@/lib/application-store";
import { useRealtime } from "@/lib/useRealtime";

const STATUS_TONE: Record<CandidateApplicationRecord["status"], string> = {
  DRAFT: "bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]",
  SUBMITTED: "bg-[#F1F3F4] text-[#45474D] border-[#DADCE0]",
  AI_INTERVIEW_PENDING: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  AI_INTERVIEW_IN_PROGRESS: "bg-[#E8F0FE] text-[#1A73E8] border-[#D2E3FC]",
  AI_INTERVIEW_COMPLETED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  SHORTLISTED: "bg-[#E8F0FE] text-[#185ABC] border-[#D2E3FC]",
  FACE_TO_FACE_SCHEDULED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  HOLD: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  ADDITIONAL_ASSESSMENT: "bg-[#FEF7E0] text-[#8A4B08] border-[#FEEFC3]",
  OFFER_PENDING: "bg-[#E8F0FE] text-[#185ABC] border-[#D2E3FC]",
  HIRED: "bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
  REJECTED: "bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]",
  WITHDRAWN: "bg-[#F1F3F4] text-[#5F6368] border-[#DADCE0]",
};

export default function ApplicationsPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { t, locale } = useLocale();
  const [applications, setApplications] = useState<CandidateApplicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "notification" || event.type === "pipeline")
      setLiveTick((current) => current + 1);
  });

  useEffect(() => {
    if (isUserLoading) return;
    let cancelled = false;

    async function loadApplications() {
      if (applications.length === 0) setIsLoading(true);
      setLoadError(null);

      if (!user) {
        setApplications([]);
        setIsLoading(false);
        setLoadError(t("appsNeedLogin"));
        return;
      }

      try {
        const response = await fetch("/api/applications", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(apiErrorText(payload, locale, t("appsLoadFail")));
        }
        if (!cancelled) {
          setApplications((payload.applications ?? []).map(fromServerApplication));
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : t("appsLoadFail"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadApplications();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoading, user, t, liveTick]);

  const completedCount = useMemo(
    () =>
      applications.filter((application) =>
        ["AI_INTERVIEW_COMPLETED", "SHORTLISTED", "FACE_TO_FACE_SCHEDULED", "HIRED"].includes(
          application.status,
        ),
      ).length,
    [applications],
  );

  const handleOffer = async (applicationId: string, decision: "ACCEPTED" | "DECLINED") => {
    const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (!response?.ok || !payload?.success) {
      setLoadError(
        apiErrorText(
          payload,
          locale,
          locale === "en" ? "Could not respond to the offer." : "Không thể phản hồi đề nghị.",
        ),
      );
      return;
    }
    setLiveTick((current) => current + 1);
  };

  const handleWithdraw = async (applicationId: string) => {
    const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "WITHDRAWN" }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (response?.ok && payload?.success)
      setApplications((current) =>
        current.map((item) =>
          item.applicationId === applicationId ? { ...item, status: "WITHDRAWN" } : item,
        ),
      );
    else setLoadError(apiErrorText(payload, locale, t("appsWithdrawFail")));
  };

  return (
    <div className="max-w-[1180px] mx-auto animate-in fade-in duration-300 font-sans pb-24">
      <header className="border-b border-[rgba(33,34,38,0.06)] pb-6 mb-7">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(183,191,217,0.14)] text-[#121317] text-[11.5px] font-[450] tracking-tight mb-2">
              <Sparkle size={13} weight="fill" className="text-[#1A73E8]" />
              {t("appsEyebrow")}
            </div>
            <h1 className="font-sans font-[450] text-2xl sm:text-3xl text-[#121317] tracking-[-0.02em]">
              {t("appsTitle")}
            </h1>
            <p className="text-[14px] text-[#45474D] mt-1 max-w-2xl leading-relaxed">
              {t("appsLead")}
            </p>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center gap-2 bg-[#121317] hover:bg-[#2D3139] text-white px-4 py-2.5 rounded-full text-[13px] font-[450] shadow-xs transition-all"
          >
            {t("appsFindJobs")} <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#45474D]">
            {t("appsTotal")}
          </div>
          <div className="text-2xl font-[450] text-[#121317] mt-1 tabular-nums">
            {applications.length}
          </div>
          <div className="text-[12px] text-[#45474D] mt-1">{t("appsByRole")}</div>
        </div>
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#45474D]">
            {t("appsDone")}
          </div>
          <div className="text-2xl font-[450] text-[#137333] mt-1 tabular-nums">
            {completedCount}
          </div>
          <div className="text-[12px] text-[#45474D] mt-1">{t("appsReviewing")}</div>
        </div>
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-2xl p-4 shadow-2xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#45474D]">
            {t("appsNext")}
          </div>
          <div className="text-[15px] font-[450] text-[#1A73E8] mt-2">
            {applications.some((item) => item.status === "FACE_TO_FACE_SCHEDULED")
              ? t("appsNextRoom")
              : applications.some((item) => item.status === "AI_INTERVIEW_PENDING")
                ? t("appsNextAi")
                : t("appsNextEach")}
          </div>
          <div className="text-[12px] text-[#45474D] mt-1">{t("appsNextLead")}</div>
        </div>
      </div>

      {loadError && (
        <div
          className="mb-5 flex items-start gap-2 rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[12.5px] text-[#C5221F]"
          role="alert"
        >
          <Clock size={16} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {isLoading ? (
        <div
          className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-10 text-center shadow-2xs"
          role="status"
          aria-live="polite"
        >
          <Clock size={24} className="mx-auto text-[#1A73E8] animate-pulse" />
          <p className="text-[13px] text-[#45474D] mt-3">{t("appsLoading")}</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-10 text-center shadow-2xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] flex items-center justify-center text-[#45474D] mb-4">
            <FileText size={26} />
          </div>
          <h2 className="text-[18px] font-[450] text-[#121317]">{t("appsEmpty")}</h2>
          <p className="text-[13px] text-[#45474D] mt-1 mb-5">{t("appsEmptyLead")}</p>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 bg-[#121317] text-white px-5 py-2.5 rounded-full text-[13px] font-[450]"
          >
            {t("appsExplore")} <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const canStartInterview =
              application.status === "AI_INTERVIEW_PENDING" ||
              application.status === "ADDITIONAL_ASSESSMENT" ||
              application.status === "SHORTLISTED";
            const hasInterview = [
              "AI_INTERVIEW_IN_PROGRESS",
              "AI_INTERVIEW_COMPLETED",
              "HOLD",
              "ADDITIONAL_ASSESSMENT",
              "SHORTLISTED",
              "FACE_TO_FACE_SCHEDULED",
              "OFFER_PENDING",
              "HIRED",
            ].includes(application.status);
            const facing = application.candidateFacing;

            return (
              <article
                key={application.applicationId}
                className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-5 sm:p-6 shadow-2xs"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-[450]",
                          STATUS_TONE[application.status],
                        )}
                      >
                        {application.status === "AI_INTERVIEW_COMPLETED" ||
                        application.status === "SHORTLISTED" ||
                        application.status === "FACE_TO_FACE_SCHEDULED" ? (
                          <CheckCircle size={13} weight="fill" />
                        ) : (
                          <Clock size={13} />
                        )}
                        {facing
                          ? candidateFacingLabel(facing, locale)
                          : applicationStatusLabel(application.status, locale)}
                      </span>
                    </div>
                    <h2 className="text-[17px] sm:text-[18px] font-[450] text-[#121317] tracking-tight truncate">
                      {application.jobTitle}
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#45474D] mt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={14} /> {application.company}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FileText size={14} /> {application.resumeName}
                      </span>
                      <span>{t("appsSubmitted", { time: application.appliedAt })}</span>
                    </div>
                    <p className="text-[13px] text-[#45474D] mt-3 leading-relaxed">
                      {facing
                        ? candidateFacingHelp(facing, locale)
                        : applicationStatusHelp(application.status, locale)}
                    </p>
                    {application.candidateMessage ? (
                      <p className="text-[13px] text-[#121317] mt-2 leading-relaxed">
                        {application.candidateMessage}
                      </p>
                    ) : null}
                    {application.offer &&
                    (application.offer.status === "SENT" ||
                      application.offer.status === "ACCEPTED" ||
                      application.offer.status === "DECLINED") ? (
                      <div className="mt-3 rounded-xl border border-[#D2E3FC] bg-[#E8F0FE] px-3 py-2.5 text-[12.5px] text-[#185ABC]">
                        <div className="font-bold">
                          {locale === "en" ? "Offer" : "Đề nghị tuyển dụng"} ·{" "}
                          {application.offer.title}
                        </div>
                        <div className="mt-1">
                          {application.offer.compensationAmount.toLocaleString(
                            locale === "en" ? "en-US" : "vi-VN",
                          )}{" "}
                          {application.offer.currency}
                        </div>
                        {application.offer.terms ? (
                          <div className="mt-1 text-[#45474D]">{application.offer.terms}</div>
                        ) : null}
                        {application.offer.status === "SENT" ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleOffer(application.applicationId, "ACCEPTED")
                              }
                              className="inline-flex rounded-full bg-[#137333] text-white px-3 py-1.5 text-[12px] font-bold"
                            >
                              {locale === "en" ? "Accept" : "Chấp nhận"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleOffer(application.applicationId, "DECLINED")
                              }
                              className="inline-flex rounded-full border border-[#C5221F] text-[#C5221F] px-3 py-1.5 text-[12px] font-bold"
                            >
                              {locale === "en" ? "Decline" : "Từ chối"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {application.status === "FACE_TO_FACE_SCHEDULED" ? (
                      <div className="mt-3 rounded-xl border border-[#CEEAD6] bg-[#E6F4EA] px-3 py-2.5 text-[12.5px] text-[#137333]">
                        <div className="font-bold">{t("appsRoomTitle")}</div>
                        <div className="mt-1">
                          {application.faceToFaceScheduledAt ?? t("appsRoomSync")}
                        </div>
                        {application.interviewerName ? (
                          <div className="mt-0.5">
                            {t("appsInterviewer", { name: application.interviewerName })}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {application.scheduleId ? (
                            <Link
                              href={`/face-to-face/${encodeURIComponent(application.scheduleId)}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#137333] text-white px-3 py-1.5 text-[12px] font-bold"
                            >
                              <VideoCamera size={13} weight="fill" /> {t("appsEnterRoom")}
                            </Link>
                          ) : (
                            <Link href="/face-to-face" className="inline-flex font-bold underline">
                              {t("appsViewRooms")}
                            </Link>
                          )}
                          {application.meetingUrl &&
                          /^https?:\/\//i.test(application.meetingUrl) &&
                          !application.meetingUrl.includes("/face-to-face/") ? (
                            <a
                              href={application.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex font-bold underline"
                            >
                              {t("appsOutsideMeet")}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canStartInterview ? (
                      <Link
                        href={`/interview/setup?applicationId=${encodeURIComponent(application.applicationId)}&jobId=${encodeURIComponent(application.jobId)}&role=${encodeURIComponent(application.jobTitle)}`}
                        className="inline-flex items-center gap-2 bg-[#121317] hover:bg-[#2D3139] text-white px-4 py-2.5 rounded-full text-[12.5px] font-[450] transition-all shadow-xs"
                      >
                        <VideoCamera size={15} weight="fill" />{" "}
                        {application.status === "AI_INTERVIEW_PENDING"
                          ? t("appsStartR1")
                          : t("appsStartNext")}
                      </Link>
                    ) : hasInterview && application.interviewId ? (
                      <Link
                        href={`/interview/report/${application.interviewId}?applicationId=${encodeURIComponent(application.applicationId)}`}
                        className="inline-flex items-center gap-2 border border-[rgba(33,34,38,0.12)] hover:border-[#121317] px-4 py-2.5 rounded-full text-[12.5px] text-[#121317] font-[450] transition-all"
                      >
                        {t("appsViewStatus")} <ArrowRight size={14} />
                      </Link>
                    ) : hasInterview ? (
                      <span className="text-[12px] text-[#B06000]">{t("appsMissingSession")}</span>
                    ) : null}
                    {!["HIRED", "REJECTED", "WITHDRAWN"].includes(application.status) && (
                      <button
                        type="button"
                        onClick={() => void handleWithdraw(application.applicationId)}
                        className="inline-flex items-center gap-1.5 text-[12px] text-[#C5221F] hover:underline px-2 py-2"
                      >
                        {t("appsWithdraw")}
                      </button>
                    )}
                    <Link
                      href="/jobs"
                      className="inline-flex items-center gap-1.5 text-[12.5px] text-[#1A73E8] hover:underline px-2 py-2"
                    >
                      {t("appsViewJobs")} <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[rgba(33,34,38,0.06)] grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                  <div>
                    <div className="text-[#5F6368] font-mono uppercase tracking-wider text-[10px]">
                      {t("appsContent")}
                    </div>
                    <div className="text-[#121317] mt-1">{t("appsContentVal")}</div>
                  </div>
                  <div>
                    <div className="text-[#5F6368] font-mono uppercase tracking-wider text-[10px]">
                      {t("appsEval")}
                    </div>
                    <div className="text-[#121317] mt-1">
                      {hasInterview ? t("appsEvalYes") : t("appsEvalNo")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#5F6368] font-mono uppercase tracking-wider text-[10px]">
                      {t("appsScore")}
                    </div>
                    <div className="text-[#45474D] mt-1">{t("appsScoreHint")}</div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
