import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleApplication,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import {
  listInterviewReviews,
  rethrowHiringError,
  upsertInterviewReview,
} from "@/lib/hiring-service";
import { errorResponse } from "@/lib/server-utils";

const Schema = z
  .object({
    sessionId: z.string().min(1).optional(),
    status: z.enum(["DRAFT", "SUBMITTED"]).default("DRAFT"),
    overallRecommendation: z.enum(["ADVANCE", "HOLD", "REJECT", "OFFER"]).optional(),
    strengths: z.string().trim().max(4000).optional(),
    concerns: z.string().trim().max(4000).optional(),
    comment: z.string().trim().max(4000).optional(),
    privateNote: z.string().trim().max(4000).optional(),
    criteria: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          rating: z.number().int().min(1).max(5),
          comment: z.string().trim().max(500).optional(),
        }),
      )
      .max(20)
      .optional(),
  })
  .strict();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const reviews = await listInterviewReviews(user, id);
    return NextResponse.json({ success: true, reviews });
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
          hiringError instanceof Error ? hiringError.message : "Không thể tải phiếu đánh giá.",
          status,
        );
    }
    return errorResponse("Không thể tải phiếu đánh giá.", 503);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Phiếu đánh giá không hợp lệ.", 400);
  const { id } = await context.params;
  try {
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "interview:write", application.job.company.id)))
      return errorResponse("Bạn không có quyền lưu phiếu đánh giá phỏng vấn.", 403);
    const review = await upsertInterviewReview({ user, applicationId: id, ...parsed.data });
    const reviews = await listInterviewReviews(user, id);
    return NextResponse.json(
      { success: true, review: { id: review.id, status: review.status }, reviews },
      { status: 201 },
    );
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
          hiringError instanceof Error ? hiringError.message : "Không thể lưu phiếu đánh giá.",
          status,
        );
    }
    return errorResponse("Không thể lưu phiếu đánh giá.", 503);
  }
}
