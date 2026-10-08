"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChatCircle,
  Clock,
  FilePdf,
  FileText,
  Microphone,
  MicrophoneSlash,
  MonitorArrowUp,
  NotePencil,
  PhoneDisconnect,
  Sparkle,
  User,
  Users,
  VideoCamera,
  VideoCameraSlash,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  X,
  Copy,
  Check,
  Briefcase,
  Phone,
  EnvelopeSimple,
  MapPin,
  GraduationCap,
  PaperPlaneRight,
  Lightning,
  Eye,
  Article,
} from "@phosphor-icons/react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  attachRemoteMedia,
  connectFaceToFaceLiveKit,
  listenRoomChat,
  sendRoomChat,
} from "@/lib/livekit-browser";
import { cn } from "@/lib/utils";
import { MediaConsentDialog, hasMediaConsent } from "@/components/MediaConsentDialog";
import { useLocale } from "@/lib/i18n";
import styles from "./room.module.css";

type ParsedResumeData = {
  fullName: string | null;
  currentJobTitle: string | null;
  yearsOfExperience: number;
  extractedSkills: string[];
  education: string[];
  summary: string;
  sections: Record<string, string>;
  email: string | null;
  phone: string | null;
  location: string | null;
  experiences: Array<{
    role: string;
    company: string;
    period: string;
    bullets: string[];
  }>;
};

type CandidateDossier = {
  candidate: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string | null;
    phone?: string | null;
    location?: string | null;
    jobTitle?: string | null;
    yearsOfExperience?: number;
  };
  resume: {
    fileName: string | null;
    fileUrl: string | null;
    parsedText: string | null;
    parsed?: ParsedResumeData | null;
  } | null;
  aiScreening: {
    sessionId: string;
    createdAt: string;
    targetRole: string;
    overallScore: number;
    technicalScore: number;
    starOverallScore: number;
    recommendation: string | null;
    summaryText: string | null;
    strengths: string[];
    improvements: string[];
  } | null;
  notes: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
};

type SchedulePayload = {
  id: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  candidateName: string;
  candidateEmail: string;
  interviewerName: string | null;
  scheduledAt: string;
  notes: string | null;
  externalMeetingUrl: string | null;
  candidateDossier?: CandidateDossier | null;
};

type ChatItem = { id: string; from: string; text: string; mine?: boolean };

export default function FaceToFaceRoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const scheduleId = typeof params?.id === "string" ? params.id : "";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [role, setRole] = useState<"candidate" | "interviewer">("candidate");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [livekitMessage, setLivekitMessage] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [remoteNames, setRemoteNames] = useState<string[]>([]);

  // Drawer / Sidebar state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"cv" | "ai" | "notes" | "chat">("cv");

  // Call duration timer
  const [callDuration, setCallDuration] = useState(0);

  // Chat state
  const [chatDraft, setChatDraft] = useState("");
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);

  // Notes state
  const [noteDraft, setNoteDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [localNotes, setLocalNotes] = useState<
    Array<{ id: string; body: string; authorName: string; createdAt: string }>
  >([]);

  // CV Display Mode & Copy Feedback
  const [cvViewMode, setCvViewMode] = useState<"structured" | "raw">("structured");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      })
      .catch(() => null);
  };

  const [consentOk, setConsentOk] = useState(() => hasMediaConsent("camera-mic"));

  useEffect(() => {
    setLivekitMessage((current) => current || t("f2fJoining"));
  }, [t]);

  // Timer đếm thời gian cuộc gọi
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!scheduleId || !consentOk) return;
    let cancelled = false;

    void (async () => {
      const meta = await fetch(`/api/face-to-face/${encodeURIComponent(scheduleId)}`, {
        cache: "no-store",
      }).catch(() => null);
      const metaJson = await meta?.json().catch(() => null);
      if (cancelled) return;
      if (!meta?.ok || !metaJson?.success) {
        setError(metaJson?.error ?? t("f2fLoadRoom"));
        return;
      }
      setSchedule(metaJson.schedule);
      const userRole = metaJson.role === "interviewer" ? "interviewer" : "candidate";
      setRole(userRole);
      setDisplayName(metaJson.displayName ?? "");

      if (userRole === "interviewer") {
        setDrawerOpen(true);
        if (Array.isArray(metaJson.schedule?.candidateDossier?.notes)) {
          setLocalNotes(metaJson.schedule.candidateDossier.notes);
        }
      }

      const livekitPromise = fetch(`/api/face-to-face/${encodeURIComponent(scheduleId)}/livekit`, {
        cache: "no-store",
      }).catch(() => null);

      const mediaWithTimeout = (constraints: MediaStreamConstraints, ms: number) =>
        Promise.race([
          navigator.mediaDevices.getUserMedia(constraints),
          new Promise<MediaStream>((_, reject) =>
            window.setTimeout(() => reject(new Error("media-timeout")), ms),
          ),
        ]);

      try {
        const stream = await mediaWithTimeout(
          { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
          4000,
        ).catch(async () => {
          setCamOn(false);
          return mediaWithTimeout({ audio: true, video: false }, 3000);
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current && stream.getVideoTracks().length > 0)
          localVideoRef.current.srcObject = stream;
        if (stream.getVideoTracks().length === 0) setCamOn(false);
      } catch (mediaError) {
        setCamOn(false);
        setError(mediaError instanceof Error ? t("f2fMediaSoft") : t("f2fMediaHard"));
      }

      const livekit = await livekitPromise;
      const livekitJson = await livekit?.json().catch(() => null);
      if (cancelled) return;
      if (!livekitJson?.configured || !livekitJson.url || !livekitJson.token) {
        setLivekitMessage(livekitJson?.message ?? t("f2fNoLivekit"));
        return;
      }
      try {
        const room = await connectFaceToFaceLiveKit({
          url: livekitJson.url,
          token: livekitJson.token,
          localStream: localStreamRef.current,
        });
        if (cancelled) {
          room.disconnect();
          return;
        }
        roomRef.current = room;
        setLivekitMessage(t("f2fJoined"));

        if (remoteRef.current) {
          attachRemoteMedia(room, remoteRef.current, (_count, names) => {
            setRemoteNames(names);
          });
        }

        listenRoomChat(room, ({ from, text }) => {
          setChatItems((current) => [...current, { id: `${Date.now()}-${from}`, from, text }]);
        });
      } catch (connError) {
        setLivekitMessage(t("f2fConnectFail"));
      }
    })();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [scheduleId, consentOk, t]);

  const toggleMic = async () => {
    const stream = localStreamRef.current;
    const room = roomRef.current;
    const next = !micOn;
    setMicOn(next);
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    if (room?.localParticipant) {
      await room.localParticipant.setMicrophoneEnabled(next);
    }
  };

  const toggleCam = async () => {
    const stream = localStreamRef.current;
    const room = roomRef.current;
    const next = !camOn;
    setCamOn(next);
    stream?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    if (room?.localParticipant) {
      await room.localParticipant.setCameraEnabled(next);
    }
  };

  const toggleShare = async () => {
    const room = roomRef.current;
    if (!room) {
      setError(t("f2fShareNeed"));
      return;
    }
    if (!sharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        if (screenVideoRef.current) screenVideoRef.current.srcObject = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          await room.localParticipant.publishTrack(videoTrack, { name: "screen_share" });
          videoTrack.onended = () => {
            void toggleShare();
          };
        }
        setSharing(true);
      } catch (shareError) {
        setError(t("f2fShareFail"));
      }
    } else {
      if (screenVideoRef.current?.srcObject instanceof MediaStream) {
        screenVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
        screenVideoRef.current.srcObject = null;
      }
      await room.localParticipant.setScreenShareEnabled(false);
      setSharing(false);
    }
  };

  const sendChat = async () => {
    const text = chatDraft.trim();
    const room = roomRef.current;
    if (!text || !room) return;
    await sendRoomChat(room, text);
    setChatItems((current) => [
      ...current,
      { id: `${Date.now()}-me`, from: displayName || t("f2fYou"), text, mine: true },
    ]);
    setChatDraft("");
  };

  const handleSaveNote = async () => {
    const body = noteDraft.trim();
    if (!body || !schedule?.applicationId || isSavingNote) return;
    setIsSavingNote(true);
    try {
      const res = await fetch(
        `/api/enterprise/applications/${encodeURIComponent(schedule.applicationId)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.note) {
        setLocalNotes((prev) => [
          {
            id: data.note.id,
            body: data.note.body,
            authorName: data.note.author?.fullName || displayName,
            createdAt: data.note.createdAt || new Date().toISOString(),
          },
          ...prev,
        ]);
        setNoteDraft("");
      }
    } catch (saveError) {
      console.warn("[F2F] Failed to save note:", saveError);
    } finally {
      setIsSavingNote(false);
    }
  };

  const leave = () => {
    roomRef.current?.disconnect();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    router.push(role === "interviewer" ? "/enterprise/dashboard" : "/face-to-face");
  };

  const isInterviewer = role === "interviewer";
  const dossier = schedule?.candidateDossier;
  const peopleCount = 1 + remoteNames.length;

  return (
    <div
      className={cn(
        styles.room,
        "min-h-[100dvh] h-[100dvh] bg-[#F8F9FA] text-[#121317] flex flex-col font-sans overflow-hidden",
      )}
    >
      {/* =========================================================================
          1. ENTERPRISE MINIMAL HEADER
          ========================================================================= */}
      <header className="px-4 sm:px-6 py-4 border-b border-[#E3E5E8] bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/face-to-face"
            aria-label="PivotAssist · Phòng phỏng vấn"
            className="flex items-center gap-2 shrink-0 text-[#121317] font-semibold tracking-tight"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#121317] text-white">
              <VideoCamera size={19} weight="fill" />
            </span>
            <span className="hidden sm:inline">PivotAssist</span>
          </Link>
          <span className="hidden lg:inline h-6 w-px bg-[#E3E5E8]" />
          <div className="min-w-0">
            <p className="text-[11px] text-[#5F6368] mb-1">{t("navFaceToFace")}</p>
            <div className="flex items-center gap-2 bg-[#F1F3F4] border border-[#E3E5E8] px-3 py-1 rounded-full text-[#121317]">
              <VideoCamera size={13} className="text-[#1A73E8] shrink-0" />
              <span className="text-[12px] font-medium truncate max-w-[210px]">
                {schedule?.jobTitle ?? t("f2fLoadingRoom")}
              </span>
            </div>
          </div>
          <span className="hidden sm:inline text-[#5F6368] text-[12px]">·</span>
          <span className="hidden sm:inline text-[#5F6368] text-[12.5px]">
            {schedule?.companyName}
          </span>
          <span className="hidden md:inline text-[#5F6368] text-[12px]">·</span>
          <span className="hidden md:inline text-[#121317] text-[12.5px] font-[450]">
            {schedule?.candidateName}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
          {/* Call duration timer */}
          <div className="flex items-center gap-1.5 bg-white border border-[#E3E5E8] px-3 py-1 rounded-full text-[#121317] font-mono text-[12px]">
            <Clock size={13} className="text-[#1A73E8]" />
            <span>{formatTimer(callDuration)}</span>
          </div>

          {/* Participant count */}
          <div className="flex items-center gap-1.5 text-[#5F6368] bg-[#F1F3F4] border border-[#E3E5E8] px-3 py-1 rounded-full text-[12px]">
            <Users size={13} />
            <span>{t("f2fPeople", { n: peopleCount })}</span>
            {remoteNames.length === 0 && (
              <span className="text-[#5F6368] text-[11px] hidden sm:inline">
                {t("f2fWaitingOther")}
              </span>
            )}
          </div>

          {/* Connection status */}
          <span className="text-[#5F6368] text-[11.5px] hidden lg:inline">{livekitMessage}</span>
        </div>
      </header>

      {error ? (
        <div className="mx-6 mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[12.5px] text-red-700 shrink-0 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setError(null)}
            className="text-[#5F6368] hover:text-[#121317] shrink-0 ml-3"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* =========================================================================
          2. MAIN STAGE & SIDEBAR LAYOUT
          ========================================================================= */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Video Stage */}
        <main
          className={cn(
            styles.stage,
            "flex-1 min-w-0 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 overflow-y-auto",
          )}
        >
          {/* Screen Sharing view if active */}
          {sharing ? (
            <section className="relative overflow-hidden rounded-3xl bg-black border border-[#E3E5E8] md:col-span-2 shadow-sm flex items-center justify-center">
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-contain"
              />
              <div className="absolute bottom-4 left-4 rounded-full bg-white backdrop-blur-md border border-[#E3E5E8] px-3.5 py-1 text-[12px] text-[#121317] flex items-center gap-2">
                <MonitorArrowUp size={14} className="text-[#1A73E8]" />
                {t("f2fSharing")}
              </div>
            </section>
          ) : null}

          {/* Local Participant Webcam */}
          <section className="relative overflow-hidden rounded-3xl bg-white border border-[#E3E5E8] min-h-[220px] shadow-sm flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover -scale-x-100 transition-opacity duration-300",
                !camOn && "opacity-0",
              )}
            />
            {!camOn || !consentOk ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#5F6368] gap-2">
                <div className="w-14 h-14 rounded-full bg-[#F1F3F4] border border-[#E3E5E8] flex items-center justify-center">
                  <VideoCameraSlash size={26} />
                </div>
                <span className="text-[13px] font-medium">{t("f2fCamOff")}</span>
              </div>
            ) : null}

            {/* Local info badge */}
            <div className="absolute bottom-3.5 left-3.5 rounded-full bg-white backdrop-blur-md border border-[#E3E5E8] px-3 py-1 text-[12px] flex items-center gap-2">
              <span
                className={cn("w-2 h-2 rounded-full", micOn ? "bg-[#34A853]" : "bg-[#EA4335]")}
              />
              <span>{t("f2fYouLocal", { name: displayName || t("f2fYou") })}</span>
            </div>
          </section>

          {/* Remote Participant Webcam */}
          <section
            ref={remoteRef}
            className="relative overflow-hidden rounded-3xl bg-white border border-[#E3E5E8] min-h-[220px] shadow-sm flex items-center justify-center p-1"
          >
            {remoteNames.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-[#5F6368] gap-3 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#F1F3F4] border border-[#E3E5E8] flex items-center justify-center text-[#5F6368]">
                  <User size={28} />
                </div>
                <p className="text-[12.5px] max-w-[280px] leading-relaxed">{t("f2fRemoteWait")}</p>
              </div>
            ) : null}

            {remoteNames.length > 0 && (
              <div className="absolute bottom-3.5 left-3.5 rounded-full bg-white backdrop-blur-md border border-[#E3E5E8] px-3 py-1 text-[12px] flex items-center gap-2 z-10">
                <span className="w-2 h-2 rounded-full bg-[#34A853]" />
                <span>{remoteNames.join(", ")}</span>
              </div>
            )}
          </section>
        </main>

        {/* =========================================================================
            3. ENTERPRISE CONTEXT DRAWER (CV Viewer, AI Round 1, Notes, Chat)
            ========================================================================= */}
        {drawerOpen && (
          <aside
            className={cn(
              styles.drawer,
              "w-full md:w-[360px] xl:w-[420px] border-l border-[#E3E5E8] bg-white flex flex-col z-20 shrink-0 shadow-sm transition-all duration-300 min-h-0",
            )}
          >
            {/* 1. Header with Segmented Control Pills */}
            <div className="px-4 py-3 border-b border-[#E3E5E8] flex items-center justify-between gap-2 shrink-0 bg-[#F1F3F4]">
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#F1F3F4] border border-[#E3E5E8] flex-1 overflow-x-auto min-w-0">
                {isInterviewer && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDrawerTab("cv")}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-xl text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                        drawerTab === "cv"
                          ? "bg-white text-[#0d0f16] font-semibold shadow-xs"
                          : "text-[#5F6368] hover:text-[#121317] hover:bg-[#F1F3F4]",
                      )}
                    >
                      <FileText size={14} weight={drawerTab === "cv" ? "fill" : "regular"} />
                      <span>{t("f2fDossierTabCv")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDrawerTab("ai")}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-xl text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                        drawerTab === "ai"
                          ? "bg-[#1A73E8] text-white font-semibold shadow-xs"
                          : "text-[#5F6368] hover:text-[#121317] hover:bg-[#F1F3F4]",
                      )}
                    >
                      <Sparkle
                        size={14}
                        weight="fill"
                        className={drawerTab === "ai" ? "text-amber-700" : "text-amber-700"}
                      />
                      <span>{t("f2fDossierTabAi")}</span>
                      {typeof dossier?.aiScreening?.overallScore === "number" && (
                        <span
                          className={cn(
                            "text-[10.5px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                            drawerTab === "ai"
                              ? "bg-[#F1F3F4] text-[#121317]"
                              : "bg-amber-400/20 text-amber-700",
                          )}
                        >
                          {dossier.aiScreening.overallScore}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDrawerTab("notes")}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-xl text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                        drawerTab === "notes"
                          ? "bg-white text-[#0d0f16] font-semibold shadow-xs"
                          : "text-[#5F6368] hover:text-[#121317] hover:bg-[#F1F3F4]",
                      )}
                    >
                      <NotePencil size={14} weight={drawerTab === "notes" ? "fill" : "regular"} />
                      <span>Ghi chú</span>
                      {localNotes.length > 0 && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                            drawerTab === "notes"
                              ? "bg-white text-black"
                              : "bg-[#F1F3F4] text-[#121317]",
                          )}
                        >
                          {localNotes.length}
                        </span>
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setDrawerTab("chat")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                    drawerTab === "chat"
                      ? "bg-white text-[#0d0f16] font-semibold shadow-xs"
                      : "text-[#5F6368] hover:text-[#121317] hover:bg-[#F1F3F4]",
                  )}
                >
                  <ChatCircle size={14} weight={drawerTab === "chat" ? "fill" : "regular"} />
                  <span>{t("f2fChat")}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#5F6368] hover:text-[#121317] hover:bg-[#F1F3F4] transition-all cursor-pointer shrink-0"
                title="Đóng bảng"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Tab 1: CV / Profile Viewer */}
            {drawerTab === "cv" && isInterviewer && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#F1F3F4] hover:[&::-webkit-scrollbar-thumb]:bg-[#F1F3F4]">
                {/* 1.1 Candidate Hero Card (Google Antigravity Identity Header) */}
                <div className="relative rounded-3xl bg-white border border-[#E3E5E8] p-5 shadow-sm overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative flex items-start gap-3.5">
                    {/* Candidate Avatar */}
                    {dossier?.candidate?.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={dossier.candidate.avatarUrl}
                        alt={schedule?.candidateName || "Candidate"}
                        className="w-13 h-13 rounded-2xl object-cover border border-[#E3E5E8] shadow-md shrink-0"
                      />
                    ) : (
                      <div className="w-13 h-13 rounded-2xl bg-[#E8F0FE] p-[2px] shadow-sm shrink-0">
                        <div className="w-full h-full rounded-[14px] bg-[#E8F0FE] flex items-center justify-center text-[#121317] font-bold text-[16px] tracking-tight">
                          {(
                            (schedule?.candidateName || "U")
                              .trim()
                              .split(/\s+/)
                              .map((w) => w[0])
                              .filter(Boolean)
                              .slice(-2)
                              .join("") || "U"
                          ).toUpperCase()}
                        </div>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-[17px] font-semibold text-[#121317] tracking-tight leading-snug">
                          {schedule?.candidateName || dossier?.candidate?.fullName || "Ứng viên"}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-700 border border-emerald-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Vòng 2: Face-to-Face
                        </span>
                      </div>

                      {/* Job Title & Experience */}
                      <div className="flex items-center gap-2 flex-wrap text-[12px] text-[#5F6368] mb-2">
                        {(dossier?.candidate?.jobTitle ||
                          dossier?.resume?.parsed?.currentJobTitle ||
                          schedule?.jobTitle) && (
                          <span className="text-[#185ABC] font-medium">
                            {dossier?.candidate?.jobTitle ||
                              dossier?.resume?.parsed?.currentJobTitle ||
                              schedule?.jobTitle}
                          </span>
                        )}
                        {dossier?.candidate?.yearsOfExperience ||
                        dossier?.resume?.parsed?.yearsOfExperience ? (
                          <>
                            <span className="text-[#5F6368]">·</span>
                            <span className="inline-flex items-center gap-1 text-[#121317]">
                              <Briefcase size={13} className="text-[#5F6368]" />
                              {dossier?.candidate?.yearsOfExperience ||
                                dossier?.resume?.parsed?.yearsOfExperience}{" "}
                              năm kinh nghiệm
                            </span>
                          </>
                        ) : null}
                      </div>

                      {/* Contact Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#5F6368]">
                        {/* Email */}
                        {schedule?.candidateEmail && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(schedule.candidateEmail, "email")}
                            className="inline-flex items-center gap-1.5 bg-[#F1F3F4] hover:bg-[#F1F3F4] text-[#121317] px-2.5 py-1 rounded-xl transition-all border border-[#E3E5E8] cursor-pointer"
                            title="Bấm để sao chép email"
                          >
                            <EnvelopeSimple size={13} className="text-[#5F6368]" />
                            <span className="max-w-[160px] truncate">
                              {schedule.candidateEmail}
                            </span>
                            {copiedField === "email" ? (
                              <Check size={12} className="text-emerald-700" />
                            ) : (
                              <Copy size={12} className="text-[#5F6368]" />
                            )}
                          </button>
                        )}

                        {/* Phone */}
                        {(dossier?.candidate?.phone || dossier?.resume?.parsed?.phone) && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                dossier?.candidate?.phone || dossier?.resume?.parsed?.phone || "",
                                "phone",
                              )
                            }
                            className="inline-flex items-center gap-1.5 bg-[#F1F3F4] hover:bg-[#F1F3F4] text-[#121317] px-2.5 py-1 rounded-xl transition-all border border-[#E3E5E8] cursor-pointer"
                            title="Bấm để sao chép số điện thoại"
                          >
                            <Phone size={13} className="text-[#5F6368]" />
                            <span>
                              {dossier?.candidate?.phone || dossier?.resume?.parsed?.phone}
                            </span>
                            {copiedField === "phone" ? (
                              <Check size={12} className="text-emerald-700" />
                            ) : (
                              <Copy size={12} className="text-[#5F6368]" />
                            )}
                          </button>
                        )}

                        {/* Location */}
                        {(dossier?.candidate?.location || dossier?.resume?.parsed?.location) && (
                          <span className="inline-flex items-center gap-1 bg-[#F1F3F4] text-[#5F6368] px-2.5 py-1 rounded-xl border border-[#E3E5E8]">
                            <MapPin size={13} className="text-[#5F6368]" />
                            <span className="max-w-[170px] truncate">
                              {dossier?.candidate?.location || dossier?.resume?.parsed?.location}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PDF Document Button Card */}
                  {dossier?.resume?.fileUrl ? (
                    <div className="mt-4 pt-4 border-t border-[#E3E5E8]">
                      <a
                        href={dossier.resume.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center justify-between gap-3 bg-[#F1F3F4] hover:bg-[#F1F3F4] border border-[#E3E5E8] hover:border-blue-400/40 p-3 rounded-2xl transition-all shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400 shrink-0">
                            <FilePdf size={22} weight="fill" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-[#121317] truncate group-hover:text-[#185ABC] transition-colors">
                              {dossier.resume.fileName || "Hồ sơ xin việc.pdf"}
                            </div>
                            <div className="text-[11px] text-[#5F6368]">
                              File CV PDF gốc đính kèm
                            </div>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-[#111318] text-[12px] font-medium group-hover:bg-blue-50 transition-all shrink-0">
                          <span>{t("f2fViewCvOriginal")}</span>
                          <ArrowSquareOut size={13} weight="bold" />
                        </span>
                      </a>
                    </div>
                  ) : null}
                </div>

                {/* 1.2 View Mode Switcher (Structured vs Raw Text) */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#5F6368]">
                    Nội dung trích xuất
                  </span>
                  <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#F1F3F4] border border-[#E3E5E8]">
                    <button
                      type="button"
                      onClick={() => setCvViewMode("structured")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer flex items-center gap-1",
                        cvViewMode === "structured"
                          ? "bg-[#F1F3F4] text-[#121317] shadow-xs"
                          : "text-[#5F6368] hover:text-[#121317]",
                      )}
                    >
                      <Article
                        size={13}
                        weight={cvViewMode === "structured" ? "fill" : "regular"}
                      />
                      <span>Hồ sơ phân tích</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCvViewMode("raw")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer flex items-center gap-1",
                        cvViewMode === "raw"
                          ? "bg-[#F1F3F4] text-[#121317] shadow-xs"
                          : "text-[#5F6368] hover:text-[#121317]",
                      )}
                    >
                      <Eye size={13} weight={cvViewMode === "raw" ? "fill" : "regular"} />
                      <span>Văn bản gốc</span>
                    </button>
                  </div>
                </div>

                {/* 1.3 Mode A: Structured Profile Presentation */}
                {cvViewMode === "structured" && (
                  <div className="space-y-4">
                    {/* Skills Chips */}
                    {(dossier?.resume?.parsed?.extractedSkills?.length ?? 0) > 0 && (
                      <div className="rounded-3xl bg-[#F1F3F4] border border-[#E3E5E8] p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[12px] font-semibold text-[#121317] flex items-center gap-1.5">
                            <Sparkle size={14} weight="fill" className="text-amber-700" />
                            Kỹ năng chuyên môn
                          </h4>
                          <span className="text-[11px] text-[#5F6368] font-mono">
                            {dossier?.resume?.parsed?.extractedSkills.length} kỹ năng
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {dossier?.resume?.parsed?.extractedSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-xl text-[12px] font-normal bg-[#F1F3F4] hover:bg-[#F1F3F4] text-[#121317] border border-[#E3E5E8] transition-all"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Experience Timeline */}
                    {(dossier?.resume?.parsed?.experiences?.length ?? 0) > 0 ? (
                      <div className="rounded-3xl bg-[#F1F3F4] border border-[#E3E5E8] p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3.5">
                          <h4 className="text-[12px] font-semibold text-[#121317] flex items-center gap-1.5">
                            <Briefcase size={14} weight="fill" className="text-[#185ABC]" />
                            Kinh nghiệm làm việc
                          </h4>
                          <span className="text-[11px] text-[#5F6368] font-mono">
                            {dossier?.resume?.parsed?.experiences.length} vị trí
                          </span>
                        </div>

                        <div className="space-y-4">
                          {dossier?.resume?.parsed?.experiences.map((exp, idx) => (
                            <div
                              key={idx}
                              className="relative pl-4 border-l-2 border-blue-500/40 hover:border-blue-400 transition-colors py-1"
                            >
                              <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-[#1A73E8] ring-4 ring-[#1A73E8]/20" />
                              <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
                                <span className="text-[13.5px] font-semibold text-[#121317]">
                                  {exp.role}
                                </span>
                                <span className="text-[11px] font-mono text-[#5F6368] bg-[#F1F3F4] px-2 py-0.5 rounded-md">
                                  {exp.period}
                                </span>
                              </div>
                              <div className="text-[12px] text-[#185ABC] font-medium mb-2">
                                {exp.company}
                              </div>
                              {exp.bullets.length > 0 && (
                                <ul className="space-y-1 text-[12px] text-[#5F6368] leading-relaxed list-disc list-outside pl-3.5">
                                  {exp.bullets.map((bullet, bIdx) => (
                                    <li key={bIdx}>{bullet}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Education */}
                    {(dossier?.resume?.parsed?.education?.length ?? 0) > 0 && (
                      <div className="rounded-3xl bg-[#F1F3F4] border border-[#E3E5E8] p-4 shadow-sm">
                        <h4 className="text-[12px] font-semibold text-[#121317] flex items-center gap-1.5 mb-3">
                          <GraduationCap size={15} weight="fill" className="text-[#185ABC]" />
                          Học vấn & Bằng cấp
                        </h4>
                        <ul className="space-y-2 text-[12px] text-[#5F6368] leading-relaxed">
                          {dossier?.resume?.parsed?.education.map((edu, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 bg-[#F1F3F4] p-2 rounded-xl border border-[#E3E5E8]"
                            >
                              <span className="text-[#185ABC] mt-0.5">•</span>
                              <span>{edu}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 1.4 Mode B: Raw Extracted Text */}
                {cvViewMode === "raw" && (
                  <div className="rounded-3xl bg-[#F1F3F4] border border-[#E3E5E8] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#5F6368]">
                        Văn bản thuần trích xuất
                      </span>
                      {dossier?.resume?.parsedText && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(dossier?.resume?.parsedText || "", "rawText")
                          }
                          className="inline-flex items-center gap-1 text-[11px] text-[#5F6368] hover:text-[#121317] transition-colors cursor-pointer"
                        >
                          {copiedField === "rawText" ? (
                            <>
                              <Check size={12} className="text-emerald-700" />
                              <span className="text-emerald-700">Đã sao chép</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-[12px] text-[#121317] leading-relaxed max-h-[360px] overflow-y-auto space-y-2 whitespace-pre-wrap font-sans select-text pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#F1F3F4]">
                      {dossier?.resume?.parsedText || "Chưa có văn bản trích xuất."}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: AI Round 1 Insights */}
            {drawerTab === "ai" && isInterviewer && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#F1F3F4] hover:[&::-webkit-scrollbar-thumb]:bg-[#F1F3F4]">
                {dossier?.aiScreening ? (
                  <>
                    {/* Score Overview Cards */}
                    <div className="rounded-3xl bg-white border border-[#E3E5E8] p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-[#5F6368]">
                            Kết quả sơ loại AI
                          </div>
                          <h3 className="text-[15px] font-semibold text-[#121317] mt-0.5">
                            {dossier.aiScreening.targetRole || "Vị trí ứng tuyển"}
                          </h3>
                        </div>
                        {/* Recommendation Badge */}
                        <div
                          className={cn(
                            "px-3 py-1 rounded-full text-[11.5px] font-bold border",
                            dossier.aiScreening.overallScore >= 75
                              ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/30"
                              : dossier.aiScreening.overallScore >= 50
                                ? "bg-amber-500/20 text-amber-700 border-amber-500/30"
                                : "bg-rose-500/20 text-rose-700 border-rose-500/30",
                          )}
                        >
                          {dossier.aiScreening.overallScore >= 75
                            ? "Khuyên nhận (HIRE)"
                            : dossier.aiScreening.overallScore >= 50
                              ? "Xem xét (CONSIDER)"
                              : "Không khuyến nghị"}
                        </div>
                      </div>

                      {/* 3 Numerical Metric Blocks */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="rounded-2xl bg-[#F1F3F4] border border-[#E3E5E8] p-3 text-center">
                          <div className="text-[11px] text-[#5F6368]">{t("f2fOverallScore")}</div>
                          <div className="text-[24px] font-bold text-[#185ABC] mt-1 font-mono">
                            {dossier.aiScreening.overallScore}
                          </div>
                          <div className="text-[10px] text-[#5F6368]">/ 100</div>
                        </div>

                        <div className="rounded-2xl bg-[#F1F3F4] border border-[#E3E5E8] p-3 text-center">
                          <div className="text-[11px] text-[#5F6368]">{t("f2fTechScore")}</div>
                          <div className="text-[24px] font-bold text-emerald-700 mt-1 font-mono">
                            {dossier.aiScreening.technicalScore}
                          </div>
                          <div className="text-[10px] text-[#5F6368]">/ 100</div>
                        </div>

                        <div className="rounded-2xl bg-[#F1F3F4] border border-[#E3E5E8] p-3 text-center">
                          <div className="text-[11px] text-[#5F6368]">{t("f2fStarScore")}</div>
                          <div className="text-[24px] font-bold text-amber-700 mt-1 font-mono">
                            {dossier.aiScreening.starOverallScore}
                          </div>
                          <div className="text-[10px] text-[#5F6368]">/ 100</div>
                        </div>
                      </div>
                    </div>

                    {/* AI Executive Summary */}
                    {dossier.aiScreening.summaryText && (
                      <div className="rounded-3xl bg-[#F1F3F4] border border-[#E3E5E8] p-4 shadow-sm">
                        <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#185ABC] mb-2 flex items-center gap-1.5">
                          <Sparkle size={14} weight="fill" className="text-[#185ABC]" />
                          Đánh giá tổng quan vòng 1
                        </h4>
                        <p className="text-[12.5px] text-[#121317] leading-relaxed font-normal">
                          {dossier.aiScreening.summaryText}
                        </p>
                      </div>
                    )}

                    {/* Strengths */}
                    {dossier.aiScreening.strengths.length > 0 && (
                      <div className="rounded-3xl bg-emerald-500/[0.06] border border-emerald-500/20 p-4">
                        <h4 className="text-[11px] font-mono uppercase tracking-wider text-emerald-700 mb-2.5 flex items-center gap-1.5">
                          <CheckCircle size={15} weight="bold" />
                          {t("f2fStrengths")}
                        </h4>
                        <ul className="space-y-1.5 text-[12px] text-emerald-800 leading-relaxed">
                          {dossier.aiScreening.strengths.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-700 font-bold mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improvements */}
                    {dossier.aiScreening.improvements.length > 0 && (
                      <div className="rounded-3xl bg-amber-500/[0.06] border border-amber-500/20 p-4">
                        <h4 className="text-[11px] font-mono uppercase tracking-wider text-amber-700 mb-2.5 flex items-center gap-1.5">
                          <WarningCircle size={15} weight="bold" />
                          Điểm cần đào sâu phỏng vấn (Areas to Probe)
                        </h4>
                        <ul className="space-y-1.5 text-[12px] text-amber-800 leading-relaxed">
                          {dossier.aiScreening.improvements.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-amber-700 font-bold mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-3xl bg-[#F1F3F4] border border-[#E3E5E8] p-8 text-center text-[#5F6368] text-[12.5px]">
                    <Sparkle size={28} className="mx-auto text-[#5F6368] mb-2" />
                    {t("f2fNoAiInterview")}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Live Notes & Scorecard */}
            {drawerTab === "notes" && isInterviewer && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#F1F3F4] hover:[&::-webkit-scrollbar-thumb]:bg-[#F1F3F4]">
                {/* Note Editor Card */}
                <div className="rounded-3xl bg-white border border-[#E3E5E8] p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="f2f-note-input"
                      className="text-[11px] font-mono uppercase tracking-wider text-[#5F6368]"
                    >
                      Soạn ghi chú mới
                    </label>
                    <span className="text-[10.5px] text-[#5F6368] font-mono">
                      Nhấn Ctrl + Enter để lưu
                    </span>
                  </div>

                  {/* Quick Tag Pills */}
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {[
                      "Giao tiếp tự tin",
                      "Tư duy tốt",
                      "Kỹ thuật vững",
                      "Văn hóa phù hợp",
                      "Cần test thêm",
                    ].map((tag, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNoteDraft((prev) => (prev ? `${prev}, ${tag}` : tag))}
                        className="text-[11px] px-2.5 py-0.8 rounded-lg bg-[#F1F3F4] hover:bg-[#F1F3F4] text-[#5F6368] hover:text-[#121317] border border-[#E3E5E8] transition-all cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  <textarea
                    id="f2f-note-input"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        void handleSaveNote();
                      }
                    }}
                    rows={3}
                    placeholder={t("f2fNotePlaceholder")}
                    className="w-full rounded-2xl bg-white border border-[#E3E5E8] p-3.5 text-[12.5px] text-[#121317] placeholder:text-[#5F6368] focus:border-[#1A73E8] focus:outline-none transition-all leading-relaxed"
                  />
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-[#5F6368]">{noteDraft.length} ký tự</span>
                    <button
                      type="button"
                      onClick={() => void handleSaveNote()}
                      disabled={!noteDraft.trim() || isSavingNote}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-40 text-white rounded-xl text-[12px] font-medium transition-all shadow-sm cursor-pointer"
                    >
                      <CheckCircle size={14} weight="bold" />
                      <span>{isSavingNote ? t("f2fSavingNote") : t("f2fSaveNote")}</span>
                    </button>
                  </div>
                </div>

                {/* Notes History */}
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#5F6368]">
                      Lịch sử ghi chú
                    </span>
                    <span className="text-[11px] text-[#5F6368] font-mono">
                      {localNotes.length} ghi chú
                    </span>
                  </div>

                  {localNotes.length === 0 ? (
                    <div className="rounded-2xl bg-[#F1F3F4] border border-[#E3E5E8] p-6 text-center text-[12px] text-[#5F6368] italic">
                      {t("f2fNoNotesYet")}
                    </div>
                  ) : (
                    localNotes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-2xl bg-[#F1F3F4] border border-[#E3E5E8] p-3.5 text-[12.5px] shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#5F6368] mb-1.5">
                          <span className="font-semibold text-[#121317]">{note.authorName}</span>
                          <span className="font-mono">
                            {new Date(note.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[#121317] whitespace-pre-wrap leading-relaxed">
                          {note.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: In-call Chat */}
            {drawerTab === "chat" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#F1F3F4]">
                  {chatItems.length === 0 ? (
                    <div className="text-[12px] text-[#5F6368] text-center py-12">
                      <ChatCircle size={28} className="mx-auto text-[#5F6368] mb-2" />
                      <p>{t("f2fChatEmpty")}</p>
                    </div>
                  ) : null}
                  {chatItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-[12.5px] max-w-[85%] shadow-2xs",
                        item.mine
                          ? "bg-[#1A73E8] ml-auto text-white"
                          : "bg-[#F1F3F4] border border-[#E3E5E8] text-[#121317]",
                      )}
                    >
                      <div className="text-[10px] text-[#5F6368] mb-0.5 font-medium">
                        {item.from}
                      </div>
                      <div className="break-words leading-relaxed">{item.text}</div>
                    </div>
                  ))}
                </div>

                <form
                  className="p-3 border-t border-[#E3E5E8] flex gap-2 shrink-0 bg-white"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendChat();
                  }}
                >
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder={t("f2fChatPh")}
                    className="flex-1 rounded-2xl bg-[#F1F3F4] border border-[#E3E5E8] px-4 py-2.5 text-[12.5px] outline-none placeholder:text-[#5F6368] focus:border-[#1A73E8] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!chatDraft.trim()}
                    className="rounded-2xl bg-white text-[#111318] hover:bg-[#F1F3F4] disabled:opacity-30 px-4 py-2.5 text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <span>{t("supportSend")}</span>
                    <PaperPlaneRight size={13} weight="bold" />
                  </button>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* =========================================================================
          4. FLOATING GLASSMORPHISM CONTROL DOCK
          ========================================================================= */}
      <footer className="z-30 bg-white border-t border-[#E3E5E8] px-3 sm:px-6 py-3 flex items-center justify-center gap-2 sm:gap-3 flex-wrap shrink-0">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={() => void toggleMic()}
          aria-pressed={micOn}
          className={cn(
            "rounded-full w-10 h-10 flex items-center justify-center transition-all cursor-pointer shadow-sm",
            micOn
              ? "bg-[#F1F3F4] text-[#121317] hover:bg-[#F1F3F4]"
              : "bg-[#EA4335] text-white hover:bg-[#D93025]",
          )}
          title={micOn ? t("f2fMic") : t("f2fMicOff")}
        >
          {micOn ? (
            <Microphone size={17} weight="fill" />
          ) : (
            <MicrophoneSlash size={17} weight="bold" />
          )}
        </button>

        {/* Cam Toggle */}
        <button
          type="button"
          onClick={() => void toggleCam()}
          aria-pressed={camOn}
          className={cn(
            "rounded-full w-10 h-10 flex items-center justify-center transition-all cursor-pointer shadow-sm",
            camOn
              ? "bg-[#F1F3F4] text-[#121317] hover:bg-[#F1F3F4]"
              : "bg-[#EA4335] text-white hover:bg-[#D93025]",
          )}
          title={camOn ? t("f2fCam") : t("f2fCamOff")}
        >
          {camOn ? (
            <VideoCamera size={17} weight="fill" />
          ) : (
            <VideoCameraSlash size={17} weight="bold" />
          )}
        </button>

        {/* Screen Share */}
        <button
          type="button"
          onClick={() => void toggleShare()}
          aria-pressed={sharing}
          className={cn(
            "rounded-full w-10 h-10 flex items-center justify-center transition-all cursor-pointer shadow-sm",
            sharing ? "bg-[#1A73E8] text-white" : "bg-[#F1F3F4] text-[#121317] hover:bg-[#F1F3F4]",
          )}
          title={sharing ? t("f2fStopShare") : t("f2fShare")}
        >
          <MonitorArrowUp size={17} weight={sharing ? "fill" : "regular"} />
        </button>

        {/* Candidate Dossier Toggle (INTERVIEWER ONLY) */}
        {isInterviewer && (
          <button
            type="button"
            onClick={() => {
              setDrawerTab("cv");
              setDrawerOpen((prev) => !prev);
            }}
            className={cn(
              "rounded-full px-4 h-10 flex items-center gap-2 transition-all cursor-pointer text-[12.5px] font-medium shadow-sm",
              drawerOpen && drawerTab !== "chat"
                ? "bg-[#1A73E8] text-white"
                : "bg-[#F1F3F4] text-[#121317] hover:bg-[#F1F3F4]",
            )}
            title={t("f2fToggleDossier")}
          >
            <FileText size={16} weight="fill" />
            <span className="hidden sm:inline">{t("f2fToggleDossier")}</span>
          </button>
        )}

        {/* In-call Chat Toggle */}
        <button
          type="button"
          onClick={() => {
            setDrawerTab("chat");
            setDrawerOpen((prev) => (drawerTab === "chat" ? !prev : true));
          }}
          className={cn(
            "rounded-full w-10 h-10 flex items-center justify-center transition-all cursor-pointer shadow-sm",
            drawerOpen && drawerTab === "chat"
              ? "bg-[#1A73E8] text-white"
              : "bg-[#F1F3F4] text-[#121317] hover:bg-[#F1F3F4]",
          )}
          title={t("f2fChat")}
        >
          <ChatCircle size={17} weight="fill" />
        </button>

        {/* External Meeting URL if any */}
        {schedule?.externalMeetingUrl && (
          <a
            href={schedule.externalMeetingUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full w-10 h-10 flex items-center justify-center bg-[#F1F3F4] text-[#121317] hover:text-[#121317] hover:bg-[#F1F3F4] transition-all"
            title={t("f2fOpenOut")}
          >
            <ArrowSquareOut size={16} />
          </a>
        )}

        {/* End / Leave Call */}
        <button
          type="button"
          onClick={leave}
          className="rounded-full bg-[#EA4335] hover:bg-[#D93025] text-white px-5 h-10 flex items-center gap-2 text-[12.5px] font-medium transition-all cursor-pointer shadow-md ml-1"
          title={t("f2fLeave")}
        >
          <PhoneDisconnect size={16} weight="bold" />
          <span className="hidden sm:inline">{t("f2fLeave")}</span>
        </button>
      </footer>

      <MediaConsentDialog
        kind="camera-mic"
        open={!consentOk}
        onAccept={() => setConsentOk(true)}
        onCancel={() => router.push("/face-to-face")}
      />
    </div>
  );
}
