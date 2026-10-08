import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { deleteLocalFile } from "@/lib/local-file-storage";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const UpdateResumeSchema = z.object({ isActive: z.boolean().optional() }).strict();

const include = {
  fileAsset: { select: { filename: true, mimeType: true, fileSizeBytes: true, fileKey: true } },
} as const;

function serialize(resume: any) {
  return {
    id: resume.id,
    fileAssetId: resume.fileAssetId,
    filename: resume.fileAsset.filename,
    mimeType: resume.fileAsset.mimeType,
    fileSizeBytes: resume.fileAsset.fileSizeBytes.toString(),
    fileKey: resume.fileAsset.fileKey,
    isActive: resume.isActive,
    parsedText: resume.parsedText,
    parsed: resume.rawJson,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem CV.", 401);
  const { id } = await context.params;
  try {
    const resume = await prisma.resume.findFirst({ where: { id, userId: user.userId }, include });
    if (!resume) return errorResponse("CV không tồn tại.", 404);
    return NextResponse.json({ success: true, resume: serialize(resume) });
  } catch (error) {
    console.error("[Resume GET]", error);
    return errorResponse("Không thể tải CV.", 503);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để cập nhật CV.", 401);
  if (user.role !== "CANDIDATE") return errorResponse("Bạn không có quyền cập nhật CV.", 403);
  const { id } = await context.params;
  const parsed = UpdateResumeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Dữ liệu cập nhật CV không hợp lệ.", 400);
  if (parsed.data.isActive === undefined) return errorResponse("Chưa có thay đổi hợp lệ.", 400);
  try {
    const owned = await prisma.resume.findFirst({
      where: { id, userId: user.userId },
      select: { id: true },
    });
    if (!owned) return errorResponse("CV không tồn tại.", 404);
    const resume = await prisma.$transaction(async (tx) => {
      if (parsed.data.isActive === false) {
        const activeCount = await tx.resume.count({
          where: { userId: user.userId, isActive: true, id: { not: id } },
        });
        if (activeCount === 0) throw new Error("ACTIVE_RESUME_REQUIRED");
      }
      if (parsed.data.isActive)
        await tx.resume.updateMany({ where: { userId: user.userId }, data: { isActive: false } });
      return tx.resume.update({ where: { id }, data: { isActive: parsed.data.isActive }, include });
    });
    await writeAuditLog(user, "resume.updated", id, { isActive: parsed.data.isActive });
    return NextResponse.json({ success: true, resume: serialize(resume) });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_RESUME_REQUIRED")
      return errorResponse(
        "Tài khoản phải còn ít nhất một CV đang hoạt động.",
        409,
        "ACTIVE_RESUME_REQUIRED",
      );
    console.error("[Resume PATCH]", error);
    return errorResponse("Không thể cập nhật CV.", 503);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xóa CV.", 401);
  if (user.role !== "CANDIDATE") return errorResponse("Bạn không có quyền xóa CV.", 403);
  const { id } = await context.params;
  try {
    const resume = await prisma.resume.findFirst({
      where: { id, userId: user.userId },
      select: { id: true, fileAssetId: true, fileAsset: { select: { fileKey: true } } },
    });
    if (!resume) return errorResponse("CV không tồn tại.", 404);
    await prisma.jobMatch.deleteMany({ where: { resumeId: id } });
    await prisma.resume.delete({ where: { id } });
    await prisma.fileAsset.delete({ where: { id: resume.fileAssetId } }).catch(() => null);
    if (resume.fileAsset?.fileKey) {
      await deleteLocalFile(resume.fileAsset.fileKey);
    }
    await writeAuditLog(user, "resume.deleted", id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("[Resume DELETE]", error);
    return errorResponse("Không thể xóa CV.", 503);
  }
}
