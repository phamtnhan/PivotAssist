import {
  fetchGoogleTranslateTts,
  googleTtsLang,
  splitTextToChunks,
} from "@/lib/google-translate-tts";
import { createTtlCache } from "@/lib/ttl-cache";

type TtsGlobal = typeof globalThis & {
  __pivotTtsAudio?: ReturnType<typeof createTtlCache<Uint8Array>>;
  __pivotTtsInflight?: Map<string, Promise<Uint8Array>>;
};

const ttsGlobal = globalThis as TtsGlobal;
const audioCache = ttsGlobal.__pivotTtsAudio ?? createTtlCache<Uint8Array>(80, 5 * 60_000);
const inflight = ttsGlobal.__pivotTtsInflight ?? new Map<string, Promise<Uint8Array>>();
ttsGlobal.__pivotTtsAudio = audioCache;
ttsGlobal.__pivotTtsInflight = inflight;

export function ttsCacheKey(tl: string, text: string) {
  return `${tl}:${text}`;
}

/** Một request Google TTS / key — concurrent trùng key chỉ fetch một lần (node caching). */
export async function getGoogleTtsAudio(
  text: string,
  lang: string,
): Promise<{ audio: Uint8Array; cache: "hit" | "miss"; tl: "vi" | "en" }> {
  const tl = googleTtsLang(lang);
  const key = ttsCacheKey(tl, text);
  const cached = audioCache.get(key);
  if (cached) return { audio: cached, cache: "hit", tl };
  const running = inflight.get(key);
  if (running) return { audio: await running, cache: "hit", tl };
  const next = fetchGoogleTranslateTts(text, tl).then((buffer) => {
    const audio = new Uint8Array(buffer);
    audioCache.set(key, audio);
    return audio;
  });
  inflight.set(key, next);
  try {
    return { audio: await next, cache: "miss", tl };
  } finally {
    inflight.delete(key);
  }
}

export function warmTtsTexts(texts: string[], lang: string) {
  for (const raw of texts) {
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const first = splitTextToChunks(trimmed)[0];
    if (first) void getGoogleTtsAudio(first, lang).catch(() => undefined);
  }
}

/** Chờ chunk đầu của câu hỏi 1 — phòng nói ngay khi response về. */
export async function warmFirstTtsText(text: string | null | undefined, lang: string) {
  const trimmed = text?.replace(/\s+/g, " ").trim();
  if (!trimmed) return;
  const first = splitTextToChunks(trimmed)[0];
  if (first) await getGoogleTtsAudio(first, lang).catch(() => undefined);
}
