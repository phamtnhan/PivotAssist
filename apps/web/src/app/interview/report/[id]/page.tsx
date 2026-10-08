"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  DownloadSimple,
  LockKey,
  PaperPlaneTilt,
  Prohibit,
  VideoCamera,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import { reportCopy } from "@/lib/i18n-user";
import { fillCopy } from "@/lib/i18n-enterprise";
import { apiErrorText } from "@/lib/api-errors";

interface LiveInterviewReport {
  sessionId: string;
  applicationId: string | null;
  jobTitle: string | null;
  targetRole: string;
  sessionStatus: string;
  durationSeconds: number;
  recording: {
    status: string;
    sharedAt: string | null;
    filename: string;
    mimeType: string;
    playbackUrl: string;
  } | null;
  questions?: Array<{ id: string; order: number; prompt: string }>;
  transcripts?: Array<{ speaker: string; text: string; startElapsedMs: number }>;
}

export default function InterviewReportPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useLocale();
  const copy = reportCopy(locale);
  const sessionId = typeof params.id === "string" ? params.id : null;
  const [report, setReport] = useState<LiveInterviewReport | null>(null);
  const [audience, setAudience] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [sharePending, setSharePending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/interviews/${encodeURIComponent(sessionId)}/report`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, copy.fail));
      setReport(payload.report as LiveInterviewReport);
      setAudience(payload.audience ?? null);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [sessionId, locale, copy.fail]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const setRecordingShare = async (action: "share" | "unshare") => {
    if (!sessionId) return;
    setSharePending(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/interviews/${encodeURIComponent(sessionId)}/recording`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success)
        throw new Error(apiErrorText(payload, locale, "Không thể cập nhật quyền chia sẻ video."));
      setNotice(
        action === "share"
          ? "Video đã được gửi tới doanh nghiệp tuyển dụng."
          : "Video đã được giữ riêng tư, doanh nghiệp không còn xem được.",
      );
      await loadReport();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật quyền chia sẻ video.");
    } finally {
      setSharePending(false);
    }
  };

  const durationLabel = (seconds: number) =>
    fillCopy(copy.mins, { m: Math.floor(seconds / 60), s: String(seconds % 60).padStart(2, "0") });
  if (state === "loading")
    return (
      <div className="max-w-[760px] mx-auto py-20 text-center">
        <Clock size={28} className="mx-auto text-[#1A73E8] animate-pulse" />
        <h1 className="text-2xl mt-4">Đang tải biên bản phỏng vấn</h1>
      </div>
    );
  if (state === "error" || !report)
    return (
      <div className="max-w-[760px] mx-auto py-20 text-center">
        <h1 className="text-2xl">Không thể tải biên bản phỏng vấn</h1>
        <Link
          href="/applications"
          className="inline-flex items-center gap-2 mt-6 bg-[#121317] text-white px-5 py-2.5 rounded-full text-[13px]"
        >
          {copy.back}
          <ArrowRight size={14} />
        </Link>
      </div>
    );

  const isCandidate = audience === "candidate" && Boolean(report.applicationId);
  const recordingShared = Boolean(report.recording?.sharedAt);
  return (
    <main className="max-w-[900px] mx-auto py-8 font-sans pb-24">
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#45474D]"
        >
          <ArrowLeft size={14} weight="bold" /> {copy.back}
        </Link>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `pivotassist-interview-${report.sessionId}.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#1A73E8]"
        >
          <DownloadSimple size={14} /> Tải biên bản
        </button>
      </div>
      <section className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 sm:p-8 shadow-2xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F4EA] text-[#137333] text-[11px] font-bold">
          <CheckCircle size={13} weight="fill" /> Phỏng vấn đã hoàn tất
        </div>
        <h1 className="text-2xl sm:text-3xl font-[450] text-[#121317] mt-4">Biên bản phỏng vấn</h1>
        <p className="text-[13px] text-[#45474D] mt-2 leading-relaxed">
          {report.jobTitle ?? report.targetRole}. Hệ thống không dùng điểm số để kết luận ứng viên.
          Bạn có thể xem lại video và tự quyết định có gửi cho doanh nghiệp hay không.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[#5F6368] font-mono">
          <span>{durationLabel(report.durationSeconds)}</span>
          <span>•</span>
          <span>{report.sessionStatus}</span>
        </div>
        {report.recording ? (
          <div className="mt-7 rounded-2xl border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-[13px] font-[450] text-[#121317]">
                <VideoCamera size={17} className="text-[#1A73E8]" /> Video phỏng vấn
              </div>
              <span className={recordingShared ? "text-[#137333]" : "text-[#8A4B08]"}>
                {recordingShared ? "Đã gửi doanh nghiệp" : "Đang giữ riêng tư"}
              </span>
            </div>
            <video
              controls
              preload="metadata"
              className="w-full rounded-xl bg-black max-h-[520px]"
              src={report.recording.playbackUrl}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#45474D]">
              <LockKey size={14} /> {report.recording.filename}
            </div>
            {isCandidate ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={sharePending || recordingShared}
                  onClick={() => void setRecordingShare("share")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#121317] text-white px-4 py-2 text-[12px] disabled:opacity-50"
                >
                  <PaperPlaneTilt size={14} />{" "}
                  {sharePending ? "Đang cập nhật..." : "Gửi video cho doanh nghiệp"}
                </button>
                <button
                  type="button"
                  disabled={sharePending || !recordingShared}
                  onClick={() => void setRecordingShare("unshare")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(33,34,38,0.12)] px-4 py-2 text-[12px] disabled:opacity-50"
                >
                  <Prohibit size={14} /> Giữ riêng tư
                </button>
              </div>
            ) : null}
            {isCandidate ? (
              <p className="mt-3 text-[11.5px] text-[#5F6368]">
                Chỉ sau khi bấm “Gửi video cho doanh nghiệp”, recruiter thuộc đúng công ty của hồ sơ
                mới xem được video.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-[#FEEFC3] bg-[#FFFDF5] px-4 py-3 text-[12.5px] text-[#8A4B08]">
            Phiên này chưa có video. Kiểm tra quyền camera trước khi thực hiện lại một phiên phỏng
            vấn mới.
          </div>
        )}
        {notice ? (
          <div
            className="mt-4 rounded-xl border border-[#D2E3FC] bg-[#E8F0FE] px-4 py-3 text-[12.5px] text-[#174EA6]"
            role="status"
          >
            {notice}
          </div>
        ) : null}
        <div className="mt-7 border-t border-[rgba(33,34,38,0.06)] pt-5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#1A73E8]">
            Nội dung được ghi nhận
          </div>
          <p className="mt-2 text-[12.5px] text-[#45474D]">
            Các câu hỏi và transcript là dữ liệu tham khảo để bạn tự xem lại. Không có bảng điểm
            tổng hợp hoặc kết luận tự động thay cho recruiter.
          </p>
          {report.questions?.length ? (
            <div className="space-y-2 mt-4">
              {report.questions.map((question) => (
                <div
                  key={question.id}
                  className="rounded-xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] px-3 py-2.5 text-[12.5px] text-[#121317]"
                >
                  {question.order}. {question.prompt}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {report.transcripts?.length ? (
          <div className="mt-7 border-t border-[rgba(33,34,38,0.06)] pt-5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#1A73E8]">
              Transcript
            </div>
            <ul className="mt-3 space-y-2 text-[12.5px] text-[#45474D]">
              {report.transcripts.slice(0, 80).map((row, index) => (
                <li key={`${row.speaker}-${row.startElapsedMs}-${index}`}>
                  <span className="font-mono text-[10px] uppercase text-[#5F6368]">
                    {row.speaker}
                  </span>{" "}
                  · {row.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
