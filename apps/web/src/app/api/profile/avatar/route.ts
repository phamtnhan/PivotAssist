import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { isSafeAvatarKey, parseAvatarKey, resolveAvatarAbsolutePath } from "@/lib/avatar-file-key";
import { deleteLocalFile } from "@/lib/local-file-storage";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để cập nhật ảnh đại diện.", 401);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return errorResponse("Vui lòng chọn ảnh đại diện.", 400);
    if (file.size > 3 * 1024 * 1024)
      return errorResponse("Ảnh đại diện không được vượt quá 3MB.", 413);
    const mimeType = file.type || "image/jpeg";
    if (!ALLOWED.has(mimeType))
      return errorResponse("Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF.", 415);

    const extension = mimeType.split("/")[1] ?? "jpg";
    const fileKey = `local:uploads/avatars/${user.userId}/${randomUUID()}.${extension}`;
    const absolutePath = path.join(process.cwd(), ".data", fileKey.slice("local:".length));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    const oldAvatars = await prisma.fileAsset.findMany({
      where: { userId: user.userId, purpose: "PROFILE_PICTURE" },
      select: { id: true, fileKey: true },
    });

    await prisma.$transaction(async (tx) => {
      if (oldAvatars.length > 0) {
        await tx.fileAsset.deleteMany({
          where: { id: { in: oldAvatars.map((a) => a.id) } },
        });
      }
      await tx.fileAsset.create({
        data: {
          userId: user.userId,
          fileKey,
          filename: file.name || `avatar.${extension}`,
          mimeType,
          fileSizeBytes: BigInt(file.size),
          purpose: "PROFILE_PICTURE",
        },
      });
      await tx.user.update({
        where: { id: user.userId },
        data: { avatarUrl: `/api/profile/avatar?key=${encodeURIComponent(fileKey)}` },
      });
    });

    for (const old of oldAvatars) {
      if (old.fileKey && old.fileKey !== fileKey) {
        await deleteLocalFile(old.fileKey);
      }
    }

    await writeAuditLog(user, "profile.avatar_updated", user.userId);
    return NextResponse.json({
      success: true,
      avatarUrl: `/api/profile/avatar?key=${encodeURIComponent(fileKey)}`,
    });
  } catch (error) {
    console.error("[Avatar POST]", error);
    return errorResponse("Không thể lưu ảnh đại diện.", 503);
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem ảnh đại diện.", 401);
  const key = new URL(request.url).searchParams.get("key") ?? "";
  const parsedKey = parseAvatarKey(key);
  if (!parsedKey) {
    return errorResponse("Không có quyền truy cập ảnh này.", 403);
  }

  let isAuthorized = user.userId === parsedKey.targetUserId || user.role === "ADMIN";
  if (!isAuthorized) {
    const hasApplication = await prisma.application.findFirst({
      where: {
        userId: parsedKey.targetUserId,
        job: {
          company: {
            members: {
              some: {
                userId: user.userId,
              },
            },
          },
        },
      },
      select: { id: true },
    });
    if (hasApplication) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return errorResponse("Không có quyền truy cập ảnh này.", 403);
  }

  const absolutePath = resolveAvatarAbsolutePath(key);
  if (!absolutePath) {
    return errorResponse("Không có quyền truy cập ảnh này.", 403);
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(absolutePath);
    const extension = path.extname(absolutePath).slice(1) || "jpeg";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": `image/${extension === "jpg" ? "jpeg" : extension}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return errorResponse("Không tìm thấy ảnh đại diện.", 404);
  }
}
