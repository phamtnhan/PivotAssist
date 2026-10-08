import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { safeFileName } from "@/lib/free-ai-server";
import { resolveLocalDataAbsolutePath } from "@/lib/local-file-storage";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";
import { validateFilePolicy } from "@pivotassist/storage";
import { accessibleApplicationWhere, isEnterpriseUser } from "@/lib/enterprise-server";

export const runtime = "nodejs";

const ShareSchema = z.object({ action: z.enum(["share", "unshare"]) }).strict();

async function findSession(id: string, userId: string) {
  return prisma.interviewSession.findFirst({
    where: { id, userId },
    select: {
      id: true,
      userId: true,
      status: true,
      recordingStatus: true,
      recordingSharedAt: true,
      recordingAssetId: true,
      applicationId: true,
      recordingAsset: {
        select: { id: true, fileKey: true, filename: true, mimeType: true, fileSizeBytes: true },
      },
    },
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để tải recording.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ ứng viên sở hữu phiên mới được tải recording.", 403);
  const { id } = await context.params;
  const session = await findSession(id, user.userId);
  if (!session) return errorResponse("Không tìm thấy phiên phỏng vấn.", 404);
  if (session.status !== "COMPLETED")
    return errorResponse("Chỉ có thể lưu recording sau khi phiên đã hoàn tất.", 409);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function")
    return errorResponse("Thiếu file recording.", 400);
  const recordingFile = file as File;
  const rawMime = recordingFile.type || "video/webm";
  const mimeType = rawMime.split(";")[0]?.trim().toLowerCase() || "video/webm";
  try {
    validateFilePolicy("INTERVIEW_RECORDING", mimeType, recordingFile.size);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Recording không hợp lệ.", 400);
  }

  const filename = safeFileName(recordingFile.name || `interview-${id}.webm`);
  const fileKey = `local:uploads/recordings/${user.userId}/${randomUUID()}-${filename}`;
  const absolutePath = path.join(process.cwd(), ".data", fileKey.slice("local:".length));
  try {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(await recordingFile.arrayBuffer()));
    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.fileAsset.create({
        data: {
          userId: user.userId,
          fileKey,
          filename,
          mimeType,
          fileSizeBytes: BigInt(recordingFile.size),
          purpose: "INTERVIEW_RECORDING",
        },
      });
      return tx.interviewSession.update({
        where: { id: session.id },
        data: { recordingAssetId: asset.id, recordingStatus: "READY", recordingSharedAt: null },
        select: { id: true, recordingStatus: true, recordingSharedAt: true },
      });
    });
    await writeAuditLog(user, "interview.recording_uploaded", session.id, {
      mimeType,
      fileSizeBytes: recordingFile.size,
    });
    return NextResponse.json(
      {
        success: true,
        recording: {
          ...created,
          playbackUrl: `/api/interviews/${encodeURIComponent(id)}/recording`,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    await unlink(absolutePath).catch(() => null);
    console.error("[Interview recording POST]", error);
    return errorResponse("Không thể lưu recording phiên phỏng vấn.", 503);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ ứng viên mới được quyết định chia sẻ recording.", 403);
  const parsed = ShareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Hành động chia sẻ không hợp lệ.", 400);
  const { id } = await context.params;
  const session = await findSession(id, user.userId);
  if (!session) return errorResponse("Không tìm thấy phiên phỏng vấn.", 404);
  if (!session.recordingAssetId || session.recordingStatus !== "READY")
    return errorResponse("Phiên chưa có recording sẵn sàng.", 409);
  const sharedAt = parsed.data.action === "share" ? new Date() : null;
  const updated = await prisma.interviewSession.update({
    where: { id },
    data: { recordingSharedAt: sharedAt },
    select: { id: true, recordingStatus: true, recordingSharedAt: true },
  });
  await writeAuditLog(
    user,
    parsed.data.action === "share" ? "interview.recording_shared" : "interview.recording_unshared",
    id,
    {},
  );
  return NextResponse.json({
    success: true,
    recording: { ...updated, playbackUrl: `/api/interviews/${encodeURIComponent(id)}/recording` },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem recording.", 401);
  const { id } = await context.params;
  const session =
    user.role === "CANDIDATE"
      ? await findSession(id, user.userId)
      : isEnterpriseUser(user)
        ? await prisma.interviewSession.findFirst({
            where: {
              id,
              recordingSharedAt: { not: null },
              application: accessibleApplicationWhere(user),
            },
            select: {
              id: true,
              recordingStatus: true,
              recordingAsset: { select: { fileKey: true, filename: true, mimeType: true } },
            },
          })
        : null;
  if (!session || session.recordingStatus !== "READY" || !session.recordingAsset)
    return errorResponse("Recording không tồn tại hoặc chưa được ứng viên chia sẻ.", 404);
  const absolutePath = resolveLocalDataAbsolutePath(session.recordingAsset.fileKey);
  if (!absolutePath) return errorResponse("Recording hiện không có trên local storage.", 404);
  try {
    const bytes = await readFile(absolutePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": session.recordingAsset.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${session.recordingAsset.filename.replace(/[\"\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return errorResponse("Không thể đọc recording.", 404);
  }
}
