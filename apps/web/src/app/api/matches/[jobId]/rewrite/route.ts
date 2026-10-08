import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rewriteBullet } from "@pivotassist/free-ai";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  GeminiRequestError,
  isGeminiConfigured,
  rewriteBulletWithGemini,
} from "@/lib/gemini-server";
import { errorResponse } from "@/lib/server-utils";

const Schema = z.object({ originalBullet: z.string().trim().min(5).max(2000) }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để viết lại CV.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Tính năng viết lại CV chỉ dành cho ứng viên.", 403);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Bullet CV không hợp lệ.", 400);
  const { jobId } = await context.params;
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        isPublished: true,
        archivedAt: null,
        company: { verificationStatus: "VERIFIED" },
      },
      select: { title: true, descriptionRaw: true },
    });
    if (!job) return errorResponse("Tin tuyển dụng không tồn tại hoặc đã đóng.", 404);
    if (isGeminiConfigured()) {
      const gemini = await rewriteBulletWithGemini({
        originalBullet: parsed.data.originalBullet,
        jobTitle: job.title,
        jobDescription: job.descriptionRaw,
      });
      return NextResponse.json({
        success: true,
        rewrite: {
          originalBullet: parsed.data.originalBullet,
          ...gemini,
          formulaUsed: "XYZ_FORMULA",
        },
        provider: "gemini",
      });
    }
    return NextResponse.json({
      success: true,
      rewrite: rewriteBullet({
        originalBullet: parsed.data.originalBullet,
        jobTitle: job.title,
        jobDescription: job.descriptionRaw,
      }),
      provider: "free-heuristic-v1",
    });
  } catch (error) {
    console.error("[Match Rewrite POST]", error instanceof Error ? error.message : error);
    if (error instanceof GeminiRequestError)
      return errorResponse(error.message, 503, "GEMINI_FAILED");
    return errorResponse("Không thể viết lại mục trong CV.", 503);
  }
}
