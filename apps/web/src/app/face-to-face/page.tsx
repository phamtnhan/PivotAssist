"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarBlank, Users, VideoCamera } from "@phosphor-icons/react";
import { useUser } from "@/lib/useUser";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import { useRealtime } from "@/lib/useRealtime";

type Meeting = {
  id: string;
  scheduledAt: string;
  interviewerName: string | null;
  jobTitle: string;
  companyName: string;
  candidateName: string;
  status: string;
  roomHref: string;
  externalMeetingUrl: string | null;
};

export default function FaceToFaceListPage() {
  const { user } = useUser();
  const { t, locale } = useLocale();
  const isEnterprise = Boolean(user && ["RECRUITER", "ADMIN"].includes(user.role));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveTick, setLiveTick] = useState(0);
  useRealtime((event) => {
    if (event.type === "pipeline" || event.type === "notification")
      setLiveTick((current) => current + 1);
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/face-to-face", { cache: "no-store" }).catch(() => null);
      const payload = await response?.json().catch(() => null);
      if (cancelled) return;
      if (!response?.ok || !payload?.success) {
        setError(apiErrorText(payload, locale, t("f2fLoadFail")));
        setLoading(false);
        return;
      }
      setMeetings(payload.schedules ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [liveTick, locale, t]);

  return (
    <div className="max-w-[880px] mx-auto pb-20">
      <header className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F0FE] text-[#185ABC] text-[11.5px] font-[450] mb-2">
          <Users size={13} weight="fill" /> {t("f2fEyebrow")}
        </div>
        <h1 className="text-2xl font-[450] tracking-tight">
          {isEnterprise ? t("f2fTitleEnt") : t("f2fTitleUser")}
        </h1>
        <p className="text-[13.5px] text-[#45474D] mt-1">
          {isEnterprise ? t("f2fLeadEnt") : t("f2fLeadUser")}
        </p>
        {isEnterprise ? (
          <Link
            href="/enterprise/dashboard"
            className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-[450] text-[#1A73E8]"
          >
            {t("entNavPipeline")} <ArrowRight size={14} />
          </Link>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-4 py-3 text-[13px] text-[#C5221F]">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-[13px] text-[#5F6368]">{t("f2fLoading")}</p> : null}
      {!loading && meetings.length === 0 && !error ? (
        <div className="rounded-[26px] border border-[rgba(33,34,38,0.08)] bg-white p-10 text-center">
          <CalendarBlank size={28} className="mx-auto text-[#1A73E8]" />
          <h2 className="mt-3 text-[17px] font-[450]">{t("f2fEmpty")}</h2>
          <p className="mt-1 text-[13px] text-[#45474D]">
            {isEnterprise ? t("f2fLeadEnt") : t("f2fLeadUser")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <article
              key={meeting.id}
              className="rounded-[24px] border border-[rgba(33,34,38,0.08)] bg-white p-5 shadow-2xs"
            >
              <div className="text-[11px] font-mono text-[#5F6368]">
                {meeting.status === "COMPLETED" || meeting.status === "DONE"
                  ? t("f2fStatusCompleted")
                  : meeting.status === "CANCELLED" || meeting.status === "CANCELED"
                    ? t("f2fStatusCancelled")
                    : t("f2fStatusScheduled")}
              </div>
              <h2 className="mt-1 text-[17px] font-[450]">{meeting.jobTitle}</h2>
              <p className="text-[13px] text-[#45474D] mt-1">
                {meeting.companyName} · {meeting.candidateName}
                {meeting.interviewerName ? ` · ${meeting.interviewerName}` : ""}
              </p>
              <p className="text-[13px] mt-2">
                {new Date(meeting.scheduledAt).toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={meeting.roomHref}
                  className="inline-flex items-center gap-2 rounded-full bg-[#121317] text-white px-4 py-2 text-[12.5px] font-[450]"
                >
                  <VideoCamera size={15} weight="fill" /> {t("f2fEnter")}
                </Link>
                {meeting.externalMeetingUrl ? (
                  <a
                    href={meeting.externalMeetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(33,34,38,0.12)] px-4 py-2 text-[12.5px]"
                  >
                    {t("f2fMeetOut")} <ArrowRight size={13} />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
