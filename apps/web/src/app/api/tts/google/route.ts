import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { consumeKeyedLimit } from "@/lib/keyed-limit";
import { GOOGLE_TTS_MAX_CHUNK } from "@/lib/google-translate-tts";
import { getGoogleTtsAudio } from "@/lib/tts-cache";
import { errorResponse } from "@/lib/server-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để nghe giọng đọc.", 401);

  const ttsLimit = await consumeKeyedLimit("tts", user.userId, 20, 60_000);
  if (!ttsLimit.ok) {
    return errorResponse("Quá nhiều yêu cầu đọc giọng nói. Vui lòng thử lại sau.", 429);
  }

  const text = (request.nextUrl.searchParams.get("text") ?? "").trim();
  const lang = request.nextUrl.searchParams.get("tl") ?? "vi";
  const turnKey = (request.nextUrl.searchParams.get("turnKey") ?? "").trim();
  if (turnKey.length > 191) return errorResponse("Mã TTS không hợp lệ.", 400);
  if (text.length < 1) return errorResponse("Thiếu nội dung cần đọc.", 400);
  if (text.length > GOOGLE_TTS_MAX_CHUNK) {
    return errorResponse(`Mỗi đoạn TTS tối đa ${GOOGLE_TTS_MAX_CHUNK} ký tự.`, 400);
  }

  try {
    const { audio, cache } = await getGoogleTtsAudio(text, lang);
    return new NextResponse(Buffer.from(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=300",
        "X-TTS-Provider": "google-translate-tts",
        "X-TTS-Cache": cache,
        ...(turnKey ? { "X-TTS-Key": turnKey } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lấy được Google Translate TTS.";
    return errorResponse(message, 502);
  }
}
