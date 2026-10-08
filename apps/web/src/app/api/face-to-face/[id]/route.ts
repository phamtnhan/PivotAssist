import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAccessibleSchedule, serializeSchedule } from "@/lib/face-to-face-server";
import { errorResponse } from "@/lib/server-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để vào phòng phỏng vấn.", 401);
  const { id } = await context.params;
  try {
    const schedule = await findAccessibleSchedule(user, id);
    if (!schedule)
      return errorResponse("Phòng phỏng vấn không tồn tại hoặc bạn không có quyền.", 404);
    const isInterviewer = user.role !== "CANDIDATE";
    return NextResponse.json({
      success: true,
      schedule: serializeSchedule(schedule, isInterviewer),
      role: isInterviewer ? "interviewer" : "candidate",
      displayName: user.fullName ?? user.email,
    });
  } catch (error) {
    console.error("[Face-to-face GET]", error);
    return errorResponse("Không thể tải phòng phỏng vấn.", 503);
  }
}
