import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLiveKitParticipantToken, isLiveKitConfigured, liveKitUrl } from "@/lib/livekit";
import { findAccessibleSchedule, liveKitRoomNameForSchedule } from "@/lib/face-to-face-server";
import { errorResponse } from "@/lib/server-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để lấy token phòng họp.", 401);
  const { id } = await context.params;
  if (!isLiveKitConfigured()) {
    return NextResponse.json({
      success: true,
      configured: false,
      localMediaOnly: true,
      message:
        "LiveKit chưa cấu hình. Bạn vẫn thấy camera/mic local, chưa có participant phía bên kia.",
    });
  }
  try {
    const schedule = await findAccessibleSchedule(user, id);
    if (!schedule)
      return errorResponse("Phòng phỏng vấn không tồn tại hoặc bạn không có quyền.", 404);
    if (schedule.status === "CANCELLED") return errorResponse("Lịch này đã hủy.", 409);
    const roomName = liveKitRoomNameForSchedule(schedule.id);
    const token = await createLiveKitParticipantToken({
      identity: user.userId,
      name: user.fullName || user.email,
      roomName,
    });
    return NextResponse.json({
      success: true,
      configured: true,
      localMediaOnly: false,
      url: liveKitUrl(),
      roomName,
      token,
    });
  } catch (error) {
    console.error("[Face-to-face LiveKit]", error instanceof Error ? error.message : error);
    return errorResponse("Không thể cấp quyền vào phòng phỏng vấn.", 503);
  }
}
