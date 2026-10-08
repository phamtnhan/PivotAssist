import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractResumeText, safeFileName } from "@/lib/free-ai-server";
import { errorResponse } from "@/lib/server-utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để phân tích tin tuyển dụng.", 401);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return errorResponse("Vui lòng chọn tệp tin tuyển dụng.", 400);
    if (file.size > 10 * 1024 * 1024)
      return errorResponse("Tệp tin tuyển dụng không được vượt quá 10MB.", 413);
    const filename = safeFileName(file.name || "job-description.txt");
    const mimeType =
      file.type || (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain");
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractResumeText(buffer, mimeType, filename);
    if (text.length < 20)
      return errorResponse(
        "Không đọc được nội dung tin tuyển dụng. Hãy dùng PDF có chữ, Markdown hoặc TXT.",
        422,
      );
    return NextResponse.json({ success: true, filename, text: text.slice(0, 20_000) });
  } catch (error) {
    console.error("[JD Parse POST]", error);
    return errorResponse("Không thể phân tích tệp tin tuyển dụng.", 503);
  }
}
