import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  getCandidateOffer,
  respondToOffer,
  rethrowHiringError,
  toPublicOffer,
} from "@/lib/hiring-service";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse } from "@/lib/server-utils";

const RespondSchema = z.object({ decision: z.enum(["ACCEPTED", "DECLINED"]) }).strict();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem đề nghị tuyển dụng.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ ứng viên mới xem đề nghị của mình.", 403);
  const { id } = await context.params;
  try {
    const result = await getCandidateOffer(user, id);
    return NextResponse.json({
      success: true,
      offer: result.offer,
      candidateMessage: result.candidateMessage,
    });
  } catch (error) {
    try {
      rethrowHiringError(error);
    } catch (hiringError) {
      const status =
        hiringError && typeof hiringError === "object" && "status" in hiringError
          ? Number((hiringError as { status: number }).status)
          : 0;
      if (status)
        return errorResponse(
          hiringError instanceof Error ? hiringError.message : "Không thể tải đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể tải đề nghị.", 503);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để phản hồi đề nghị.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ ứng viên mới phản hồi đề nghị của mình.", 403);
  const parsed = RespondSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Cần chọn chấp nhận hoặc từ chối.", 400);
  const { id } = await context.params;
  try {
    const result = await respondToOffer({
      user,
      applicationId: id,
      decision: parsed.data.decision,
    });
    return NextResponse.json({
      success: true,
      already: result.already,
      hired: result.hired,
      offer: toPublicOffer(result.offer),
    });
  } catch (error) {
    try {
      rethrowHiringError(error);
    } catch (hiringError) {
      const status =
        hiringError && typeof hiringError === "object" && "status" in hiringError
          ? Number((hiringError as { status: number }).status)
          : 0;
      if (status)
        return errorResponse(
          hiringError instanceof Error ? hiringError.message : "Không thể phản hồi đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể phản hồi đề nghị.", 503);
  }
}
