import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { findAccessibleApplication, isEnterpriseUser } from "@/lib/enterprise-server";
import { resolveLocalDataAbsolutePath } from "@/lib/local-file-storage";
import { errorResponse } from "@/lib/server-utils";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    const resume = await prisma.resume
      .findUnique({
        where: { id: application.resumeId ?? "" },
        select: {
          parsedText: true,
          fileAsset: { select: { filename: true, mimeType: true, fileKey: true } },
        },
      })
      .catch(() => null);
    if (!resume) return errorResponse("Hồ sơ chưa có CV.", 404);
    let body = Buffer.from(resume.parsedText ?? "", "utf8");
    if (resume.fileAsset.fileKey.startsWith("local:")) {
      const safePath = resolveLocalDataAbsolutePath(resume.fileAsset.fileKey);
      if (safePath) {
        body = await readFile(safePath).catch(() => body);
      }
    }
    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": resume.fileAsset.mimeType || "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${resume.fileAsset.filename.replace(/[\"\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[Enterprise Resume GET]", error);
    return errorResponse("Không thể mở CV.", 503);
  }
}
