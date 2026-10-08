"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Microphone,
  MicrophoneSlash,
  VideoCamera,
  VideoCameraSlash,
  PhoneDisconnect,
  Sparkle,
  ArrowRight,
  WarningCircle,
  LockKey,
  CheckCircle,
  SpinnerGap,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import {
  inspectSpeechVoices,
  speakInterviewerText,
  stopInterviewerSpeech,
  subscribeSpeechVoices,
  type SpeechVoiceStatus,
} from "@/lib/browser-speech";
import {
  startBrowserStt,
  startFallbackMicStt,
  type BrowserSttHandle,
  type FallbackSttHandle,
} from "@/lib/browser-stt";
import {
  isPromptEcho,
  mergeSttDraft,
  shouldInterruptAssistantSpeech,
} from "@/lib/voice-turn-behavior";
import { useLocale } from "@/lib/i18n";
import { apiErrorText } from "@/lib/api-errors";
import { sanitizeInterviewPrompt } from "@/lib/interview-copy";

const startedSessionIds = new Set<string>();

function InterviewRoomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");
  const { displayName } = useUser();
  const { t, locale } = useLocale();

  // Control state
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [questionSeconds, setQuestionSeconds] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string;
    order: number;
    category?: string;
    prompt: string;
  } | null>(null);
  const [currentQuestionTtsKey, setCurrentQuestionTtsKey] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);
  const [answerDraft, setAnswerDraft] = useState("");
  const [voiceInputActive, setVoiceInputActive] = useState(false);
  const speechRecognitionRef = useRef<BrowserSttHandle | null>(null);
  const fallbackSttRef = useRef<FallbackSttHandle | null>(null);
  const ignoreSttUntilRef = useRef(0);
  const answerDraftRef = useRef("");
  const micMutedRef = useRef(false);
  answerDraftRef.current = answerDraft;
  micMutedRef.current = isMicMuted;
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [applicationJobId, setApplicationJobId] = useState<string | null>(null);
  const [applicationRole, setApplicationRole] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [isTurnPending, setIsTurnPending] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [interviewLang, setInterviewLang] = useState("vi-VN");
  const [ttsStatus, setTtsStatus] = useState<SpeechVoiceStatus | null>(null);
  const [hasLocalMic, setHasLocalMic] = useState(false);
  const [hasLocalCamera, setHasLocalCamera] = useState(false);
  const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
  const speakingRef = useRef(false);
  speakingRef.current = isInterviewerSpeaking;
  const spokenTtsKeysRef = useRef(new Set<string>());
  const initialTtsKeyRef = useRef<string | null>(null);
  const pendingTurnIdRef = useRef<string | null>(null);
  const currentPromptRef = useRef("");

  // Dialog State
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Audio Waveform Data from Web Audio API
  const [audioFrequencies, setAudioFrequencies] = useState<number[]>(
    Array.from({ length: 15 }, () => 10),
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingApplicationId = params.get("applicationId");
    const incomingJobId = params.get("jobId");
    const incomingRole = params.get("role");
    const incomingSessionId = params.get("sessionId");
    const incomingLang = params.get("lang");

    if (incomingApplicationId) setApplicationId(incomingApplicationId);
    if (incomingJobId) setApplicationJobId(incomingJobId);
    if (incomingRole) setApplicationRole(incomingRole);
    if (incomingLang === "en") setInterviewLang("en-US");
    else if (incomingLang === "vi") setInterviewLang("vi-VN");
    if (incomingSessionId) {
      setSessionId(incomingSessionId);
      void (async () => {
        const startPromise = startedSessionIds.has(incomingSessionId)
          ? Promise.resolve(null)
          : fetch(`/api/interviews/${encodeURIComponent(incomingSessionId)}/start`, {
              method: "POST",
            }).catch(() => null);
        startedSessionIds.add(incomingSessionId);
        const [startResponse, response] = await Promise.all([
          startPromise,
          fetch(
            `/api/interviews/${encodeURIComponent(incomingSessionId)}/questions?lang=${encodeURIComponent(incomingLang === "en" ? "en" : "vi")}`,
            { cache: "no-store" },
          ).catch(() => null),
        ]);
        if (startResponse && !startResponse.ok)
          console.warn("Interview session could not be moved to IN_PROGRESS.");
        const payload = await response?.json().catch(() => null);
        if (
          response?.ok &&
          payload?.success &&
          Array.isArray(payload.questions) &&
          payload.questions.length > 0
        ) {
          const adaptiveClosed =
            payload.currentQuestion === null &&
            typeof payload.turnNumber === "number" &&
            payload.turnNumber > 0;
          const firstQuestion = (payload.currentQuestion ??
            (adaptiveClosed ? null : payload.questions[0])) as
            { id?: string; order?: number; category?: string; prompt?: string } | null | undefined;
          if (firstQuestion?.id && firstQuestion.prompt) {
            setCurrentQuestion({
              id: firstQuestion.id,
              order: typeof firstQuestion.order === "number" ? firstQuestion.order : 1,
              category: firstQuestion.category,
              prompt: sanitizeInterviewPrompt(
                firstQuestion.prompt,
                incomingLang === "en" ? "en" : "vi",
              ),
            });
            setTurnNumber(typeof payload.turnNumber === "number" ? payload.turnNumber : 0);
            setCurrentQuestionTtsKey(
              typeof payload.currentTtsKey === "string"
                ? payload.currentTtsKey
                : `${incomingSessionId}:question:${firstQuestion.id}`,
            );
          } else if (adaptiveClosed) {
            setCurrentQuestion(null);
            setCurrentQuestionTtsKey(null);
            setTurnNumber(payload.turnNumber);
            setShowExitConfirm(true);
          }
          if (typeof payload.targetRole === "string" && payload.targetRole && !incomingRole)
            setApplicationRole(payload.targetRole);
          if (payload.language === "en") setInterviewLang("en-US");
          else if (payload.language === "vi" || payload.language === "vi-VN")
            setInterviewLang("vi-VN");
          setQuestionsError(null);
        } else {
          setCurrentQuestion(null);
          setQuestionsError(apiErrorText(payload, locale, t("roomNoQ")));
        }
      })();
    } else {
      setSessionMissing(true);
      setQuestionsError(t("roomNoSession"));
    }
    // Chỉ đọc URL một lần khi vào phòng — không refetch khi `t` đổi identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeSpeechVoices(() => setTtsStatus(inspectSpeechVoices(interviewLang)));
  }, [sessionId, interviewLang]);

  const currentPrompt = sanitizeInterviewPrompt(currentQuestion?.prompt ?? "", interviewLang);
  currentPromptRef.current = currentPrompt;

  const markTtsPlayed = (ttsKey: string): boolean => {
    if (spokenTtsKeysRef.current.has(ttsKey)) return false;
    try {
      if (window.sessionStorage.getItem(`pivotassist:tts:${ttsKey}`) === "played") return false;
      window.sessionStorage.setItem(`pivotassist:tts:${ttsKey}`, "played");
    } catch {
      // Browser storage can be disabled; the in-memory guard still prevents
      // React StrictMode/replay duplicates during this page lifetime.
    }
    spokenTtsKeysRef.current.add(ttsKey);
    return true;
  };

  useEffect(() => {
    const prompt = currentPrompt;
    if (!sessionId || !prompt) return;
    const ttsKey =
      currentQuestionTtsKey ?? `${sessionId}:question:${currentQuestion?.id ?? "unknown"}`;
    if (initialTtsKeyRef.current === ttsKey || !markTtsPlayed(ttsKey)) return;
    initialTtsKeyRef.current = ttsKey;
    let cancelled = false;
    setIsInterviewerSpeaking(true);
    const unlockMic = window.setTimeout(() => {
      if (!cancelled) setIsInterviewerSpeaking(false);
    }, 5_000);
    void speakInterviewerText(prompt, interviewLang, ttsKey).then((status) => {
      if (cancelled) return;
      window.clearTimeout(unlockMic);
      setTtsStatus(status);
      setIsInterviewerSpeaking(false);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(unlockMic);
      stopInterviewerSpeech();
      setIsInterviewerSpeaking(false);
    };
  }, [sessionId, currentQuestion?.id, currentQuestionTtsKey, currentPrompt, interviewLang]);

  useEffect(() => {
    if (!sessionId || typeof window === "undefined") {
      speechRecognitionRef.current?.stop();
      speechRecognitionRef.current = null;
      setVoiceInputActive(false);
      return;
    }
    const handle = startBrowserStt({
      lang: interviewLang,
      onTranscript: (text) => {
        // Echo loopback prevention: do NOT record while interviewer is speaking or during post-speech cooldown
        if (speakingRef.current || micMutedRef.current || Date.now() < ignoreSttUntilRef.current) {
          return;
        }
        // Echo cancellation: if the transcript echoes the question during/right after assistant speech, drop it
        if (
          currentPromptRef.current &&
          Date.now() < ignoreSttUntilRef.current + 1000 &&
          isPromptEcho(text, currentPromptRef.current)
        ) {
          return;
        }
        setAnswerDraft(text);
      },
      onActive: setVoiceInputActive,
      shouldIgnore: () =>
        speakingRef.current || micMutedRef.current || Date.now() < ignoreSttUntilRef.current,
    });
    speechRecognitionRef.current = handle;
    return () => {
      handle?.stop();
      speechRecognitionRef.current = null;
      setVoiceInputActive(false);
    };
  }, [sessionId, interviewLang]);

  useEffect(() => {
    if (isInterviewerSpeaking) {
      fallbackSttRef.current?.reset();
      return;
    }
    // Set 800ms cooldown to allow speaker reverberation and delayed Web Speech packets to clear
    ignoreSttUntilRef.current = Date.now() + 800;
    speechRecognitionRef.current?.recycle();
    fallbackSttRef.current?.arm();
  }, [isInterviewerSpeaking]);

  useEffect(() => {
    if (!sessionId || !hasLocalMic) {
      fallbackSttRef.current?.stop();
      fallbackSttRef.current = null;
      return;
    }
    const stream = mediaStreamRef.current;
    if (!stream) return;
    const handle = startFallbackMicStt({
      stream,
      lang: interviewLang,
      shouldSkip: () =>
        Boolean(speechRecognitionRef.current) ||
        speakingRef.current ||
        micMutedRef.current ||
        Date.now() < ignoreSttUntilRef.current ||
        Boolean(answerDraftRef.current.trim()),
      onTranscript: (text) =>
        setAnswerDraft((current) => (current.trim() ? `${current.trim()} ${text}` : text)),
      onActive: setVoiceInputActive,
    });
    fallbackSttRef.current = handle;
    if (!speakingRef.current) handle.arm();
    return () => {
      handle.stop();
      fallbackSttRef.current = null;
    };
  }, [sessionId, interviewLang, hasLocalMic]);

  // Initialize Web Audio & Video stream — only after a real session exists
  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;
    const previewElement = videoPreviewRef.current;

    async function initMedia() {
      try {
        if (typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          const preferredMic = window.sessionStorage.getItem("pivotassist:selectedMic");
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              ...(preferredMic ? { deviceId: { ideal: preferredMic } } : {}),
            },
            video: {
              facingMode: { ideal: "user" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });

          if (!isMounted) return;
          mediaStreamRef.current = stream;
          setHasLocalMic(true);
          setHasLocalCamera(stream.getVideoTracks().length > 0);
          if (previewElement) {
            previewElement.srcObject = stream;
            await previewElement.play().catch(() => null);
          }
          if (
            typeof MediaRecorder !== "undefined" &&
            (stream.getVideoTracks().length > 0 || stream.getAudioTracks().length > 0)
          ) {
            const hasVideo = stream.getVideoTracks().length > 0;
            const candidates = hasVideo
              ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
              : ["audio/webm;codecs=opus", "audio/webm"];
            const mimeType = candidates.find((candidate) =>
              MediaRecorder.isTypeSupported(candidate),
            );
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            recordingChunksRef.current = [];
            recorder.ondataavailable = (event) => {
              if (event.data.size > 0) recordingChunksRef.current.push(event.data);
            };
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
          }

          // Web Audio API Setup
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let lastPaint = 0;

            const updateAudio = (now: number) => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);

              if (now - lastPaint >= 80) {
                lastPaint = now;
                const sampled = [];
                const step = Math.floor(dataArray.length / 15);
                for (let i = 0; i < 15; i++) {
                  const val = dataArray[i * step] || 0;
                  sampled.push(Math.max(10, Math.min(95, Math.round((val / 255) * 100))));
                }
                setAudioFrequencies(sampled);
              }
              animationFrameRef.current = requestAnimationFrame(updateAudio);
            };

            updateAudio(performance.now());
          }
        }
      } catch (err) {
        console.warn("Media devices not accessible or permission denied:", err);
      }
    }

    void initMedia();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewElement) previewElement.srcObject = null;
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, [sessionId]);

  const stopBrowserRecording = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(
          recordingChunksRef.current.length
            ? new Blob(recordingChunksRef.current, { type: "video/webm" })
            : null,
        );
        return;
      }
      recorder.addEventListener(
        "stop",
        () => {
          resolve(
            recordingChunksRef.current.length
              ? new Blob(recordingChunksRef.current, { type: recorder.mimeType || "video/webm" })
              : null,
          );
        },
        { once: true },
      );
      if (recorder.state === "recording") {
        recorder.requestData();
      }
      recorder.stop();
      mediaRecorderRef.current = null;
    });

  useEffect(() => {
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !isMicMuted;
    });
  }, [isMicMuted]);

  // Timers
  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
      setQuestionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleNextQuestion = async () => {
    if (isTurnPending || !sessionId) return;
    const text = answerDraft.trim();
    const questionId = currentQuestion?.id;
    if (!questionId) {
      setShowExitConfirm(true);
      return;
    }
    if (!text) {
      setTurnError(
        interviewLang.startsWith("en")
          ? "Say or type an answer before moving to the next question."
          : "Hãy nói hoặc nhập câu trả lời trước khi chuyển sang câu hỏi tiếp theo.",
      );
      return;
    }

    setIsTurnPending(true);
    setTurnError(null);
    stopInterviewerSpeech();

    const turnId =
      pendingTurnIdRef.current ??
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);
    pendingTurnIdRef.current = turnId;

    try {
      const response = await fetch(
        `/api/interviews/${encodeURIComponent(sessionId)}/agent-turn?lang=${interviewLang.startsWith("en") ? "en" : "vi"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateSpeechText: text,
            questionId,
            elapsedMs: sessionSeconds * 1000,
            turnId,
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        setTurnError(apiErrorText(payload, locale, t("roomTurnError")));
        setIsTurnPending(false);
        return;
      }

      speechRecognitionRef.current?.reset();
      fallbackSttRef.current?.reset();
      setAnswerDraft("");
      setTurnError(null);
      pendingTurnIdRef.current = null;

      if (payload.isLastQuestion || !payload.nextQuestion) {
        if (
          typeof payload.replyAudioText === "string" &&
          payload.replyAudioText.trim() &&
          payload.ttsKey
        ) {
          const ttsKey = String(payload.ttsKey);
          if (markTtsPlayed(ttsKey)) {
            setIsInterviewerSpeaking(true);
            void speakInterviewerText(payload.replyAudioText, interviewLang, ttsKey).finally(() => {
              setIsInterviewerSpeaking(false);
            });
          }
        }
        setShowExitConfirm(true);
      } else {
        const newPrompt = sanitizeInterviewPrompt(payload.nextQuestion.prompt, interviewLang);
        setCurrentQuestion({
          id: payload.nextQuestion.id,
          order:
            typeof payload.nextQuestion.order === "number"
              ? payload.nextQuestion.order
              : turnNumber + 2,
          category: payload.nextQuestion.category,
          prompt: newPrompt,
        });
        setCurrentQuestionTtsKey(String(payload.ttsKey ?? `${sessionId}:${turnId}`));
        setTurnNumber((prev) => prev + 1);
        setQuestionSeconds(0);

        const ttsKey = String(payload.ttsKey ?? `${sessionId}:${turnId}`);
        if (markTtsPlayed(ttsKey)) {
          setIsInterviewerSpeaking(true);
          void speakInterviewerText(newPrompt, interviewLang, ttsKey).finally(() => {
            setIsInterviewerSpeaking(false);
          });
        }
      }
    } catch (err) {
      setTurnError(err instanceof Error ? err.message : t("roomTurnError"));
    } finally {
      setIsTurnPending(false);
    }
  };

  const handleConfirmExit = async () => {
    if (isCompleting) return;
    setCompletionError(null);
    setIsCompleting(true);

    try {
      speechRecognitionRef.current?.stop();
      speechRecognitionRef.current = null;
      fallbackSttRef.current?.stop();
      fallbackSttRef.current = null;
      stopInterviewerSpeech();

      if (sessionId && answerDraft.trim() && currentQuestion?.id) {
        await fetch(`/api/interviews/${encodeURIComponent(sessionId)}/transcripts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: currentQuestion.id,
            speaker: "candidate",
            text: answerDraft.trim(),
            startElapsedMs: Math.max(0, (sessionSeconds - questionSeconds) * 1000),
            endElapsedMs: sessionSeconds * 1000,
            confidence: 0.8,
            turnId: `early-exit:${sessionId}:${Date.now()}`,
            sequenceNumber: turnNumber * 2 + 2,
            mode: "ADAPTIVE",
          }),
        }).catch(() => null);
      }

      const recordingBlob = await stopBrowserRecording();
      if (sessionId) {
        const response = await fetch(`/api/interviews/${encodeURIComponent(sessionId)}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationSeconds: sessionSeconds }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(apiErrorText(payload, locale, t("roomCompleteFail")));
        }
        if (recordingBlob && recordingBlob.size > 0) {
          const form = new FormData();
          form.append(
            "file",
            new File([recordingBlob], `interview-${sessionId}.webm`, {
              type: recordingBlob.type || "video/webm",
            }),
          );
          const recordingResponse = await fetch(
            `/api/interviews/${encodeURIComponent(sessionId)}/recording`,
            { method: "POST", body: form },
          );
          const recordingPayload = await recordingResponse.json().catch(() => null);
          if (!recordingResponse.ok || !recordingPayload?.success) {
            console.warn(
              "Interview recording could not be saved after completion.",
              apiErrorText(recordingPayload, locale, "Không thể lưu video phỏng vấn."),
            );
          }
        }
      } else {
        throw new Error(t("roomNoSessionId"));
      }

      const reportId = sessionId;
      const params = new URLSearchParams();
      if (applicationId) params.set("applicationId", applicationId);
      if (applicationJobId) params.set("jobId", applicationJobId);
      router.push(
        `/interview/report/${reportId}${params.toString() ? `?${params.toString()}` : ""}`,
      );
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : t("roomCompleteFail"));
      setIsCompleting(false);
    }
  };

  if (!urlSessionId) {
    return (
      <main id="main-content" tabIndex={-1} className="max-w-[640px] mx-auto px-6 py-16 font-sans">
        <h1 className="text-[22px] font-[450] text-[#121317]">{t("roomBadge")}</h1>
        <p className="mt-3 text-[14px] text-[#45474D]" role="alert">
          {t("roomNoSession")}
        </p>
        <Link
          href="/interview/setup"
          className="mt-6 inline-flex items-center gap-2 bg-[#121317] text-white text-[13.5px] font-[450] px-5 py-2.5 rounded-full"
        >
          {t("crumbSetup")}
          <ArrowRight size={13} weight="bold" />
        </Link>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="max-w-[1240px] mx-auto animate-in fade-in duration-300 font-sans pb-20"
    >
      {/* =========================================================================
          1. WEB APP STATUS & URL BAR (Google Antigravity Window Header)
          ========================================================================= */}
      <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] px-6 py-3.5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] px-3 py-1 rounded-full text-[#45474D]">
            <LockKey size={13} className="text-[#45474D]" />
            <span className="font-mono text-[11px]">{t("roomBadge")}</span>
          </div>

          <div className="flex items-center gap-1.5 font-sans text-[12px] text-[#137333] font-[450]">
            <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
            {hasLocalMic ? t("roomMicOn") : t("roomMicOff")}
          </div>
        </div>

        <div className="flex items-center gap-5 text-[12.5px]">
          <div className="flex items-center gap-1.5 text-[#45474D]">
            <span>{t("roomDuration")}:</span>
            <span className="font-[450] text-[#121317] font-mono text-[13px]">
              {formatTimer(sessionSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[rgba(183,191,217,0.14)] text-[#121317] px-3 py-1 rounded-full font-[450] text-[12px]">
            <span>{t("roomProgress")}:</span>
            <span>{t("roomQuestion", { current: turnNumber + 1 })}</span>
          </div>
        </div>
      </div>

      {(questionsError || sessionMissing || ttsStatus) && (
        <div
          className="mb-6 rounded-2xl border border-[rgba(33,34,38,0.08)] bg-[#F8F9FA] px-4 py-3 text-[12.5px] text-[#45474D] space-y-1"
          role="status"
        >
          {ttsStatus ? (
            <p>
              {ttsStatus.provider === "google-translate-tts"
                ? t("roomTtsGoogle", { lang: ttsStatus.voiceLang ?? interviewLang })
                : ttsStatus.provider === "speechSynthesis"
                  ? t("roomTtsFallback", {
                      detail: ttsStatus.voiceName ? ` (${ttsStatus.voiceName})` : "",
                    })
                  : t("roomTtsNone", { lang: interviewLang })}
            </p>
          ) : null}
          {questionsError ? (
            <p className="text-[#C5221F]" role="alert">
              {questionsError}
            </p>
          ) : null}
        </div>
      )}

      {/* =========================================================================
          2. MAIN STAGE: AI INTERVIEWER + TRANSCRIPT (không camera)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-stretch">
        {/* LEFT: AI INTERVIEWER AGENT (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 sm:p-7 flex flex-col justify-between shadow-2xs min-h-[420px]">
          {/* AI Header Info */}
          <div className="flex items-center justify-between gap-2 border-b border-[rgba(33,34,38,0.06)] pb-4 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold shrink-0">
                <Sparkle size={15} weight="fill" />
              </div>
              <div className="min-w-0">
                <div className="font-sans font-[450] text-[14px] text-[#121317] truncate">
                  {t("roomExaminer")} • {applicationRole || t("roomExaminerRole")}
                </div>
                <div className="text-[11.5px] text-[#45474D]">{t("roomEvalAfter")}</div>
              </div>
            </div>

            {voiceInputActive ? (
              <span className="font-sans text-[11px] font-[450] text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] px-3 py-1 rounded-full flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] animate-pulse" />
                {t("roomListening")}
              </span>
            ) : (
              <span className="font-sans text-[11px] font-[450] text-[#5F6368] bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] px-3 py-1 rounded-full shrink-0">
                {t("roomIdle")}
              </span>
            )}
          </div>

          {/* AI Voice Reactive Equalizer Waveform */}
          <div className="my-auto py-6 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 h-16 mb-4">
              {audioFrequencies.map((val, idx) => (
                <div
                  key={idx}
                  className="w-1.5 rounded-full bg-[#1A73E8] transition-all duration-75"
                  style={{
                    height: `${Math.max(10, isMicMuted ? 6 : val * 0.75)}px`,
                    opacity: isMicMuted ? 0.3 : 0.6 + (val / 100) * 0.4,
                  }}
                />
              ))}
            </div>

            <div className="text-[13px] text-[#121317] font-[450] flex items-center gap-1.5">
              <Sparkle size={14} weight="fill" className="text-[#1A73E8]" />
              <span>{isMicMuted ? t("roomMicMuted") : t("roomMicOpenHint")}</span>
            </div>
            <div className="text-[11.5px] text-[#45474D] mt-1">
              {t("roomQTimer")}{" "}
              <strong className="font-mono text-[#121317]">{formatTimer(questionSeconds)}</strong>
            </div>
          </div>

          {/* Current Question Box */}
          <div className="bg-[#F8F9FA] border border-[rgba(33,34,38,0.08)] rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#45474D] mb-1.5">
              <span className="text-[#1A73E8] font-semibold">
                {t("roomQLabel", { n: turnNumber + 1 })}
              </span>
              <span>{t("roomQHint")}</span>
            </div>
            <p
              data-testid="interview-prompt"
              data-question-index={turnNumber + 1}
              data-question-total="adaptive"
              className="text-[14px] font-[450] text-[#121317] leading-relaxed"
            >
              {currentPrompt || (questionsError ?? t("roomLoadQ"))}
            </p>
            {sessionId && (
              <div className="mt-3">
                {turnError && (
                  <div className="mb-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 flex items-center justify-between gap-2">
                    <span>{turnError}</span>
                    <button
                      type="button"
                      onClick={() => void handleNextQuestion()}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-[450] shrink-0 cursor-pointer"
                    >
                      {t("roomRetryTurn")}
                    </button>
                  </div>
                )}
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[10.5px] font-mono uppercase tracking-wider text-[#5F6368]">
                  <span>{t("roomTranscript")}</span>
                  <span className={voiceInputActive ? "text-[#137333]" : "text-[#B06000]"}>
                    {voiceInputActive ? t("roomHearing") : t("roomTypeHint")}
                  </span>
                </div>
                <textarea
                  data-testid="interview-answer"
                  value={answerDraft}
                  onChange={(event) => {
                    const text = event.target.value;
                    setAnswerDraft(text);
                    speechRecognitionRef.current?.setBaseText(text);
                  }}
                  rows={3}
                  placeholder={t("roomAnswerPh")}
                  className="w-full rounded-xl border border-[rgba(33,34,38,0.1)] bg-white px-3 py-2 text-[12.5px] text-[#121317] placeholder:text-[#5F6368] focus:border-[#1A73E8] focus:outline-none"
                  aria-label={t("roomAnswerAria")}
                />
              </div>
            )}
          </div>

          {/* Reassuring In-Session Guidance (Hidden intrusive telemetry during live call) */}
          <div className="rounded-2xl border border-[rgba(33,34,38,0.06)] bg-[#F8F9FA] p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0">
              <Microphone size={16} weight="fill" />
            </div>
            <div className="text-[12.5px] text-[#45474D] font-normal leading-relaxed">
              {t("roomRelax")}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[rgba(33,34,38,0.08)] rounded-[26px] p-6 shadow-2xs min-h-[420px] flex flex-col">
          <div className="relative overflow-hidden rounded-2xl bg-[#202124] aspect-video mb-5">
            <video
              ref={videoPreviewRef}
              muted
              playsInline
              className={cn("h-full w-full object-cover", hasLocalCamera ? "" : "hidden")}
              aria-label="Xem trước camera"
            />
            {!hasLocalCamera ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/70 text-[12px] text-center px-6">
                <VideoCameraSlash size={30} />
                <span>Camera chưa sẵn sàng. Bạn vẫn có thể tiếp tục bằng microphone và text.</span>
              </div>
            ) : null}
            <div className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] text-white/80">
              Đang ghi video trong phiên
            </div>
          </div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#1A73E8]">
            {t("roomRound")}
          </div>
          <h2 className="mt-2 text-[18px] font-[450]">{displayName}</h2>
          <p className="mt-2 text-[13px] text-[#45474D] leading-relaxed">{t("roomSideLead")}</p>
          <div className="mt-auto rounded-2xl bg-[#F8F9FA] border border-[rgba(33,34,38,0.06)] p-4 text-[12.5px] text-[#45474D]">
            {hasLocalMic ? t("roomMicReady") : t("roomMicNeed")}
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. BOTTOM CONTROL DOCK
          ========================================================================= */}
      <div className="bg-white border border-[rgba(33,34,38,0.08)] rounded-[24px] p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        {/* Device Toggles */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMicMuted(!isMicMuted)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-full font-[450] text-[12.5px] transition-all cursor-pointer",
              isMicMuted
                ? "bg-[#FCE8E6] text-[#C5221F] border border-[#F8D7DA]"
                : "bg-[#F8F9FA] text-[#121317] hover:bg-black/[0.05] border border-[rgba(33,34,38,0.08)]",
            )}
          >
            {isMicMuted ? (
              <MicrophoneSlash size={16} weight="bold" />
            ) : (
              <Microphone size={16} weight="fill" className="text-[#1A73E8]" />
            )}
            <span>{isMicMuted ? t("roomUnmute") : t("roomMute")}</span>
          </button>
        </div>

        {/* Navigation & Finalize Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleNextQuestion()}
            disabled={isTurnPending || !sessionId}
            title={t("roomDoneHint")}
            className={cn(
              "bg-[#F8F9FA] hover:bg-white text-[#121317] border border-[rgba(33,34,38,0.1)] px-5 py-2.5 rounded-full font-[450] text-[12.5px] flex items-center gap-2 transition-all shadow-2xs cursor-pointer hover:border-[rgba(33,34,38,0.2)]",
              isTurnPending && "opacity-75 cursor-not-allowed",
            )}
          >
            {isTurnPending ? (
              <>
                <SpinnerGap size={14} className="animate-spin text-[#1A73E8]" />
                <span>{t("roomProcessingTurn")}</span>
              </>
            ) : (
              <>
                <span>{t("roomDone")}</span>
                <ArrowRight size={14} weight="bold" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            disabled={!sessionId}
            className="bg-[#EA4335] hover:bg-[#D93025] text-white px-5 py-2.5 rounded-full font-[450] text-[12.5px] flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <PhoneDisconnect size={16} weight="bold" />
            <span>{t("roomEnd")}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          4. SAFE EXIT CONFIRMATION MODAL
          ========================================================================= */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-[#121317]/65 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] border border-[rgba(33,34,38,0.08)] p-7 sm:p-8 max-w-md w-full shadow-[0_25px_70px_rgba(0,0,0,0.25)] text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF7E0] text-[#B06000] flex items-center justify-center mx-auto mb-4">
              <WarningCircle size={26} weight="bold" />
            </div>

            <h3 className="font-sans font-[450] text-[18px] text-[#121317] mb-2">
              {t("roomConfirmTitle")}
            </h3>
            <p className="text-[13.5px] text-[#45474D] leading-relaxed mb-6 font-normal">
              {t("roomConfirmLead", { current: turnNumber + 1 })}
            </p>

            {completionError && (
              <div
                className="mb-5 rounded-2xl border border-[#FAD2CF] bg-[#FCE8E6] px-3.5 py-3 text-left text-[12px] text-[#C5221F]"
                role="alert"
              >
                {completionError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="bg-[#F8F9FA] hover:bg-black/[0.05] text-[#121317] border border-[rgba(33,34,38,0.1)] py-2.5 px-4 rounded-full font-[450] text-[13px] transition-all cursor-pointer"
              >
                {t("roomContinue")}
              </button>

              <button
                type="button"
                onClick={handleConfirmExit}
                disabled={isCompleting}
                className="bg-[#121317] hover:bg-[#2D3139] disabled:opacity-70 text-white py-2.5 px-4 rounded-full font-[450] text-[13px] transition-all shadow-xs cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {isCompleting && <SpinnerGap size={14} className="animate-spin" />}
                {isCompleting ? t("roomSending") : t("roomSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function InterviewRoomRoute() {
  return (
    <Suspense
      fallback={
        <main
          id="main-content"
          tabIndex={-1}
          className="max-w-[640px] mx-auto px-6 py-16 font-sans text-[14px] text-[#45474D]"
        >
          …
        </main>
      }
    >
      <InterviewRoomPage />
    </Suspense>
  );
}
