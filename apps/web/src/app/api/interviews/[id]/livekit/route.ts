// REQ-0025 — LiveKit token scoped by CompanyMember; participant name is not email
import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { accessibleInterviewSessionWhere } from "@/lib/enterprise-server";
import { createLiveKitParticipantToken, isLiveKitConfigured, liveKitUrl } from "@/lib/livekit";
import { errorResponse } from "@/lib/server-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để vào phòng phỏng vấn.", 401);
  const { id } = await context.params;
  if (!isLiveKitConfigured()) {
    return NextResponse.json({
      success: true,
      configured: false,
      localMediaOnly: true,
      message:
        "Phòng họp trực tuyến chưa cấu hình. Bạn vẫn nói được trên máy này, chưa ghép được với người kia.",
    });
  }
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, ...accessibleInterviewSessionWhere(user) },
      select: { id: true, livekitRoomName: true, userId: true },
    });
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    const displayName = user.fullName.trim() || "Participant";
    const token = await createLiveKitParticipantToken({
      identity: user.userId,
      name: displayName,
      roomName: session.livekitRoomName,
    });
    return NextResponse.json({
      success: true,
      configured: true,
      localMediaOnly: false,
      url: liveKitUrl(),
      roomName: session.livekitRoomName,
      token,
    });
  } catch (error) {
    console.error("[LiveKit token GET]", error instanceof Error ? error.message : error);
    return errorResponse("Không thể cấp LiveKit token.", 503);
  }
}
