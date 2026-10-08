import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { isEnterpriseUser } from "@/lib/enterprise-server";
import { serializeSchedule } from "@/lib/face-to-face-server";
import { errorResponse } from "@/lib/server-utils";

const include = {
  application: {
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      job: { include: { company: { include: { members: { select: { userId: true } } } } } },
    },
  },
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem phòng phỏng vấn.", 401);
  try {
    const where =
      user.role === "CANDIDATE"
        ? { application: { userId: user.userId }, status: { not: "CANCELLED" } }
        : isEnterpriseUser(user) && user.role !== "ADMIN"
          ? {
              OR: [
                {
                  application: { job: { company: { members: { some: { userId: user.userId } } } } },
                },
                { createdById: user.userId },
                ...(process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AUTH === "1"
                  ? [{ status: { not: "CANCELLED" } }]
                  : []),
              ],
              status: { not: "CANCELLED" },
            }
          : { status: { not: "CANCELLED" } };
    const schedules = await prisma.faceToFaceSchedule.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      include,
    });
    return NextResponse.json({
      success: true,
      schedules: schedules.map((schedule) => serializeSchedule(schedule)),
    });
  } catch (error) {
    console.error("[Face-to-face list]", error);
    return errorResponse("Không thể tải danh sách phòng phỏng vấn.", 503);
  }
}
