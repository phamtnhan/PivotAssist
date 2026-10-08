import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  GeminiNotConfiguredError,
  GeminiRequestError,
  transcribeGeminiAudio,
} from "@/lib/gemini-server";
import { errorResponse } from "@/lib/server-utils";

export const runtime = "nodejs";

const MAX_BYTES = 1_200_000;

type SttGlobal = typeof globalThis & { __pivotSttInflight?: Map<string, Promise<string>> };
const inflight = () => {
  const g = globalThis as SttGlobal;
  g.__pivotSttInflight ??= new Map();
  return g.__pivotSttInflight;
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để gửi bản ghi lời nói.", 401);
  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob) || file.size < 800)
    return errorResponse("Bản ghi lời nói trống hoặc quá ngắn.", 400);
  if (file.size > MAX_BYTES) return errorResponse("Bản ghi lời nói quá dài.", 413);
  const language = form?.get("lang") === "en" ? "en" : "vi";
  const mimeType = (file.type || "audio/webm").split(";")[0] || "audio/webm";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const key = `${user.userId}:${hash}`;
  const running = inflight().get(key);
  if (running) {
    const text = await running;
    return NextResponse.json({ success: Boolean(text), text, cache: "inflight" });
  }
  const next = transcribeGeminiAudio({ bytes, mimeType, language });
  inflight().set(key, next);
  try {
    const text = await next;
    if (!text) return NextResponse.json({ success: false, text: "" }, { status: 422 });
    return NextResponse.json({ success: true, text });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError)
      return errorResponse("Chưa cấu hình nhận lời nói trên máy chủ.", 503);
    if (error instanceof GeminiRequestError && error.httpStatus === 429) {
      return errorResponse(
        "Hàng đợi nhận lời nói đang đầy. Hãy gõ chữ hoặc thử lại sau vài giây.",
        429,
      );
    }
    console.warn("[Interview STT]", error instanceof Error ? error.message : error);
    return errorResponse("Không nhận được lời nói từ bản ghi.", 503);
  } finally {
    inflight().delete(key);
  }
}
