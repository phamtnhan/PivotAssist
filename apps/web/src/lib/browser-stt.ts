type RecognitionCtor = new () => BrowserSpeechRecognition;

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechResultEvent = {
  results: ArrayLike<{ isFinal: boolean; transcript?: string; 0?: { transcript?: string } }>;
};

export type BrowserSttHandle = {
  recycle: () => void;
  stop: () => void;
  reset: () => void;
  setBaseText: (text: string) => void;
};

export function isBrowserSttSupported(): boolean {
  return Boolean(recognitionCtor());
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as typeof window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

/** Nhận lời trên trình duyệt: giữ phiên liên tục, tích lũy các câu qua nhiều lần restart của Chrome. */
export function startBrowserStt(options: {
  lang: string;
  onTranscript: (text: string) => void;
  onActive: (active: boolean) => void;
  shouldIgnore: () => boolean;
}): BrowserSttHandle | null {
  const Recognition = recognitionCtor();
  if (!Recognition) return null;

  let cancelled = false;
  let restarting = false;
  let baseText = "";
  const sessionFinals: string[] = [];
  let currentSessionFinals: string[] = [];
  let currentInterim = "";

  const recognition = new Recognition();
  recognition.lang = options.lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  const markActive = () => {
    if (!cancelled) options.onActive(true);
  };

  const emitCompositeTranscript = () => {
    if (cancelled || options.shouldIgnore()) return;
    const parts = [baseText, ...sessionFinals, ...currentSessionFinals, currentInterim]
      .map((s) => s.trim())
      .filter(Boolean);
    const composite = parts.join(" ").replace(/\s+/g, " ").trim();
    if (composite) {
      markActive();
      options.onTranscript(composite);
    }
  };

  const safeStart = () => {
    if (cancelled) return;
    try {
      currentSessionFinals = [];
      currentInterim = "";
      recognition.start();
      markActive();
    } catch {
      /* phiên đã chạy */
    }
  };

  recognition.onsoundstart = markActive;
  recognition.onspeechstart = markActive;
  recognition.onresult = (event) => {
    if (options.shouldIgnore()) return;
    const finals: string[] = [];
    let interim = "";
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = (result[0]?.transcript ?? result.transcript ?? "").trim();
      if (!text) continue;
      if (result.isFinal) {
        finals.push(text);
      } else {
        interim = text;
      }
    }
    currentSessionFinals = finals;
    currentInterim = interim;
    emitCompositeTranscript();
  };
  recognition.onerror = (event) => {
    const code = event?.error ?? "";
    if (code === "no-speech" || code === "aborted") return;
    if (!cancelled) options.onActive(false);
  };
  recognition.onend = () => {
    if (cancelled) return;
    // Lưu các đoạn đã hoàn tất của phiên vừa kết thúc trước khi tái khởi động
    if (currentSessionFinals.length > 0) {
      sessionFinals.push(...currentSessionFinals);
      currentSessionFinals = [];
    }
    currentInterim = "";
    restarting = false;
    window.setTimeout(safeStart, 40);
  };

  safeStart();

  return {
    setBaseText(text: string) {
      baseText = text.trim();
      sessionFinals.length = 0;
      currentSessionFinals = [];
      currentInterim = "";
    },
    reset() {
      baseText = "";
      sessionFinals.length = 0;
      currentSessionFinals = [];
      currentInterim = "";
    },
    recycle() {
      if (cancelled || restarting) return;
      restarting = true;
      try {
        recognition.stop();
      } catch {
        restarting = false;
        safeStart();
      }
    },
    stop() {
      cancelled = true;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.onsoundstart = null;
      recognition.onspeechstart = null;
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          /* đã dừng */
        }
      }
    },
  };
}

export type FallbackSttHandle = {
  arm: () => void;
  reset: () => void;
  stop: () => void;
};

const FALLBACK_CAPTURE_MAX_MS = 30_000;

/** Cắt bản ghi khi đã có tiếng nói rồi im ~0.7s — giảm chờ đủ 4s. */
function watchSpeechEnd(stream: MediaStream, onSilence: () => void) {
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  let ctx: AudioContext;
  try {
    ctx = new AudioContextClass();
  } catch {
    return;
  }
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let heard = false;
  let silentTicks = 0;
  const timer = window.setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let power = 0;
    for (const sample of data) {
      const centered = (sample - 128) / 128;
      power += centered * centered;
    }
    const rms = Math.sqrt(power / data.length);
    if (rms > 0.045) {
      heard = true;
      silentTicks = 0;
      return;
    }
    silentTicks += 1;
    if (heard && silentTicks >= 12) {
      window.clearInterval(timer);
      void ctx.close().catch(() => undefined);
      onSilence();
    }
  }, 80);
  window.setTimeout(() => {
    window.clearInterval(timer);
    void ctx.close().catch(() => undefined);
  }, 4_200);
}

/** Khi SpeechRecognition không ra chữ: ghi mic rồi gửi /api/interviews/stt. */
export function startFallbackMicStt(options: {
  stream: MediaStream;
  lang: string;
  shouldSkip: () => boolean;
  onTranscript: (text: string) => void;
  onActive?: (active: boolean) => void;
}): FallbackSttHandle {
  let cancelled = false;
  let busy = false;
  let armed = false;
  let recorder: MediaRecorder | null = null;
  let abort: AbortController | null = null;
  let armTimer = 0;
  let stopTimer = 0;

  const captureOnce = () => {
    if (cancelled || busy) return;
    if (options.shouldSkip()) {
      armTimer = window.setTimeout(captureOnce, 250);
      return;
    }
    if (typeof MediaRecorder === "undefined") return;
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    if (!mime) return;
    busy = true;
    options.onActive?.(true);
    const chunks: Blob[] = [];
    try {
      recorder = new MediaRecorder(options.stream, { mimeType: mime });
    } catch {
      busy = false;
      return;
    }
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      void (async () => {
        try {
          const blob = new Blob(chunks, { type: mime.split(";")[0] || mime });
          if (blob.size < 1200 || options.shouldSkip() || cancelled) return;
          abort = new AbortController();
          const form = new FormData();
          form.append("audio", blob, "answer.webm");
          form.append("lang", options.lang.startsWith("en") ? "en" : "vi");
          const response = await fetch("/api/interviews/stt", {
            method: "POST",
            body: form,
            signal: abort.signal,
          });
          const payload = await response.json().catch(() => null);
          const text = typeof payload?.text === "string" ? payload.text.trim() : "";
          if (text && !cancelled) options.onTranscript(text);
        } catch {
          /* abort / mạng */
        } finally {
          busy = false;
        }
      })();
    };
    try {
      recorder.start(400);
    } catch {
      busy = false;
      return;
    }
    const stopRec = () => {
      window.clearTimeout(stopTimer);
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        busy = false;
      }
    };
    // Answers can contain a full STAR example or a system-design explanation.
    // Four seconds clipped the end of normal answers before Gemini STT saw them.
    stopTimer = window.setTimeout(stopRec, FALLBACK_CAPTURE_MAX_MS);
    watchSpeechEnd(options.stream, stopRec);
  };

  return {
    arm() {
      if (cancelled || armed) return;
      armed = true;
      armTimer = window.setTimeout(captureOnce, 400);
    },
    reset() {
      armed = false;
      window.clearTimeout(armTimer);
      window.clearTimeout(stopTimer);
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        /* đã dừng */
      }
    },
    stop() {
      cancelled = true;
      armed = false;
      window.clearTimeout(armTimer);
      window.clearTimeout(stopTimer);
      abort?.abort();
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        /* đã dừng */
      }
    },
  };
}
