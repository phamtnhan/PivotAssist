import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { resolveLocalDataAbsolutePath } from "@/lib/local-file-storage";
import { errorResponse } from "@/lib/server-utils";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để tải CV.", 401);
  const { id } = await context.params;
  try {
    const resume = await prisma.resume.findFirst({
      where: { id, userId: user.userId },
      select: {
        parsedText: true,
        fileAsset: { select: { filename: true, mimeType: true, fileKey: true } },
      },
    });
    if (!resume) return errorResponse("CV không tồn tại.", 404);
    let body: Buffer = Buffer.from(resume.parsedText ?? "", "utf8");
    if (resume.fileAsset.fileKey.startsWith("local:")) {
      const safePath = resolveLocalDataAbsolutePath(resume.fileAsset.fileKey);
      if (safePath) {
        try {
          body = await readFile(safePath);
        } catch {
          // fallback to parsedText
        }
      }
    }
    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": resume.fileAsset.mimeType || "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${resume.fileAsset.filename.replace(/[\"\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Resume Download]", error);
    return errorResponse("Không thể tải file CV.", 503);
  }
}
