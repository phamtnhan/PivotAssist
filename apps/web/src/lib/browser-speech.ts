import { googleTtsLang, splitTextToChunks } from "@/lib/google-translate-tts";

export type SpeechVoiceStatus = {
  available: boolean;
  provider: "google-translate-tts" | "speechSynthesis" | "none";
  voiceName: string | null;
  voiceLang: string | null;
  langMatched: boolean;
  voiceCount: number;
};

let playGeneration = 0;
let currentAudio: HTMLAudioElement | null = null;
const blobCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function voicesOf(synth: SpeechSynthesis): SpeechSynthesisVoice[] {
  return synth.getVoices();
}

export function pickSpeechVoice(
  lang: string,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const normalized = lang.toLowerCase();
  const prefix = normalized.split("-")[0] ?? normalized;
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalized) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${prefix}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function inspectSpeechVoices(lang: string): SpeechVoiceStatus {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return {
      available: false,
      provider: "none",
      voiceName: null,
      voiceLang: null,
      langMatched: false,
      voiceCount: 0,
    };
  }
  const voices = "speechSynthesis" in window ? voicesOf(window.speechSynthesis) : [];
  return {
    available: true,
    provider: "google-translate-tts",
    voiceName: "Google Translate TTS (cùng kiểu Kuro)",
    voiceLang: googleTtsLang(lang),
    langMatched: true,
    voiceCount: voices.length,
  };
}

export function stopInterviewerSpeech() {
  playGeneration += 1;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
}

function speakLocalFallback(text: string, lang: string): SpeechVoiceStatus {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return {
      available: false,
      provider: "none",
      voiceName: null,
      voiceLang: null,
      langMatched: false,
      voiceCount: 0,
    };
  }
  const synth = window.speechSynthesis;
  const voices = voicesOf(synth);
  const matched = pickSpeechVoice(lang, voices);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  if (matched) utterance.voice = matched;
  synth.cancel();
  synth.speak(utterance);
  return {
    available: true,
    provider: "speechSynthesis",
    voiceName: matched?.name ?? "speechSynthesis mặc định",
    voiceLang: matched?.lang ?? lang,
    langMatched: Boolean(matched),
    voiceCount: voices.length,
  };
}

function cacheKey(tl: string, chunk: string) {
  return `${tl}:${chunk}`;
}

function fetchChunkUrl(tl: string, chunk: string, turnKey?: string): Promise<string> {
  const key = cacheKey(tl, chunk);
  const hit = blobCache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(key);
  if (running) return running;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const idempotencyQuery = turnKey ? `&turnKey=${encodeURIComponent(turnKey)}` : "";
  const next = fetch(
    `/api/tts/google?tl=${encodeURIComponent(tl)}&text=${encodeURIComponent(chunk)}${idempotencyQuery}`,
    { signal: controller.signal },
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("TTS HTTP lỗi");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (blobCache.size >= 40) {
        const oldest = blobCache.keys().next().value;
        if (oldest) {
          URL.revokeObjectURL(blobCache.get(oldest) ?? "");
          blobCache.delete(oldest);
        }
      }
      blobCache.set(key, url);
      return url;
    })
    .finally(() => {
      clearTimeout(timeout);
      inflight.delete(key);
    });
  inflight.set(key, next);
  return next;
}

function playAudioUrl(url: string, generation: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (generation !== playGeneration) {
      resolve();
      return;
    }
    const audio = new Audio(url);
    currentAudio = audio;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (currentAudio === audio) currentAudio = null;
      if (error) reject(error);
      else resolve();
    };
    const timer = window.setTimeout(() => finish(), 12_000);
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error("Không phát được audio Google TTS."));
    audio
      .play()
      .catch((error) =>
        finish(error instanceof Error ? error : new Error("Không phát được audio.")),
      );
  });
}

/** Tải trước mọi đoạn TTS để câu hỏi nói liền, không ngắt giữa chừng vì chờ mạng. */
export function prefetchInterviewerSpeech(text: string, lang: string): Promise<void> {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return Promise.resolve();
  const tl = googleTtsLang(lang);
  const chunks = splitTextToChunks(trimmed);
  if (chunks.length === 0) return Promise.resolve();
  return Promise.all(chunks.map((chunk) => fetchChunkUrl(tl, chunk).catch(() => ""))).then(
    () => undefined,
  );
}

export async function speakInterviewerText(
  text: string,
  lang: string,
  turnKey?: string,
): Promise<SpeechVoiceStatus> {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return {
      available: false,
      provider: "none",
      voiceName: null,
      voiceLang: null,
      langMatched: false,
      voiceCount: 0,
    };
  }
  stopInterviewerSpeech();
  const generation = playGeneration;
  const tl = googleTtsLang(lang);
  const chunks = splitTextToChunks(trimmed);
  try {
    let upcoming = chunks[0] ? fetchChunkUrl(tl, chunks[0], turnKey) : null;
    for (let index = 0; index < chunks.length; index += 1) {
      if (generation !== playGeneration) break;
      const url = await upcoming;
      if (!url) break;
      const nextChunk = chunks[index + 1];
      upcoming = nextChunk ? fetchChunkUrl(tl, nextChunk, turnKey) : null;
      await playAudioUrl(url, generation);
    }
    return {
      available: true,
      provider: "google-translate-tts",
      voiceName: "Google Translate TTS",
      voiceLang: tl,
      langMatched: true,
      voiceCount: chunks.length,
    };
  } catch {
    if (generation !== playGeneration) {
      return {
        available: false,
        provider: "none",
        voiceName: null,
        voiceLang: null,
        langMatched: false,
        voiceCount: 0,
      };
    }
    return speakLocalFallback(trimmed, lang);
  }
}

export function subscribeSpeechVoices(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  onChange();
  if (!("speechSynthesis" in window)) return () => undefined;
  const synth = window.speechSynthesis;
  const handler = () => onChange();
  synth.addEventListener("voiceschanged", handler);
  return () => synth.removeEventListener("voiceschanged", handler);
}
