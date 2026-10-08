import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

const PatchSchema = z
  .object({ id: z.string().min(1).optional(), markAllRead: z.boolean().optional() })
  .strict();

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem thông báo.", 401);
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: user.userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      success: true,
      unreadCount: await prisma.notification.count({
        where: { userId: user.userId, readAt: null },
      }),
      notifications,
    });
  } catch (error) {
    console.error("[Notifications GET]", error);
    return errorResponse("Không thể tải thông báo.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để cập nhật thông báo.", 401);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.id && !parsed.data.markAllRead))
    return errorResponse("Dữ liệu thông báo không hợp lệ.", 400);
  try {
    if (parsed.data.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.userId, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (parsed.data.id) {
      await prisma.notification.updateMany({
        where: { id: parsed.data.id, userId: user.userId },
        data: { readAt: new Date() },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Notifications PATCH]", error);
    return errorResponse("Không thể cập nhật thông báo.", 503);
  }
}
