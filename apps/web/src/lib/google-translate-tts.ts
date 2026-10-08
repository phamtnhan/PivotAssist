/** Cùng kiểu D:\TTS_KURO: Google Translate TTS (cloud, không GPU local). Giới hạn ~200 ký tự/request. */
export const GOOGLE_TTS_HOST = "translate.googleapis.com";
export const GOOGLE_TTS_PATH = "/translate_tts";
export const GOOGLE_TTS_MAX_CHUNK = 190;

export function googleTtsLang(lang: string): "vi" | "en" {
  return lang.toLowerCase().startsWith("en") ? "en" : "vi";
}

export function splitTextToChunks(text: string, maxLen = GOOGLE_TTS_MAX_CHUNK): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  const sentenceEnders = [". ", "! ", "? ", ".\n", "!\n", "?\n"];

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let cutAt = -1;
    for (const ender of sentenceEnders) {
      const idx = remaining.lastIndexOf(ender, maxLen);
      if (idx > 0 && idx > cutAt) cutAt = idx + ender.length;
    }
    if (cutAt <= 0) {
      const commaIdx = remaining.lastIndexOf(", ", maxLen);
      if (commaIdx > 0) cutAt = commaIdx + 2;
    }
    if (cutAt <= 0) {
      const spaceIdx = remaining.lastIndexOf(" ", maxLen);
      if (spaceIdx > 0) cutAt = spaceIdx + 1;
    }
    if (cutAt <= 0) cutAt = maxLen;
    chunks.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

export function googleTranslateTtsUrl(text: string, tl: "vi" | "en"): string {
  const url = new URL(`https://${GOOGLE_TTS_HOST}${GOOGLE_TTS_PATH}`);
  url.searchParams.set("client", "gtx");
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("tl", tl);
  url.searchParams.set("q", text);
  return url.toString();
}

export async function fetchGoogleTranslateTts(text: string, tl: "vi" | "en"): Promise<Buffer> {
  const chunk = text.slice(0, GOOGLE_TTS_MAX_CHUNK);
  const href = googleTranslateTtsUrl(chunk, tl);
  const parsed = new URL(href);
  if (parsed.hostname !== GOOGLE_TTS_HOST || parsed.pathname !== GOOGLE_TTS_PATH) {
    throw new Error("TTS URL is not allowed");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(parsed.href, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "audio/mpeg,*/*",
      },
    });
    if (!response.ok) {
      throw new Error(`Google Translate TTS HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}
