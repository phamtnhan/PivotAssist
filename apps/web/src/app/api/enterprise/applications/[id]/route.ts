// REQ-0001 — PATCH status HIRED is rejected (409); hiring mutations stay on Next
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleApplication,
  hasEnterpriseCapability,
  isEnterpriseUser,
  mapEnterpriseApplication,
} from "@/lib/enterprise-server";
import { HiringDecisionActionSchema } from "@pivotassist/contracts";
import {
  decideApplication,
  getEnterpriseOfferForApplication,
  listInterviewReviews,
  rethrowHiringError,
} from "@/lib/hiring-service";
import { errorResponse } from "@/lib/server-utils";
import { disallowedOriginResponse } from "@/lib/request-origin";

const UpdateApplicationSchema = z
  .object({
    action: HiringDecisionActionSchema.optional(),
    status: z.enum(["SHORTLISTED", "REJECTED"]).optional(),
    internalReason: z.string().trim().max(4000).optional(),
    candidateMessage: z.string().trim().max(4000).optional(),
    idempotencyKey: z.string().trim().max(120).optional(),
  })
  .strict();

function mapLegacyStatus(status: "SHORTLISTED" | "REJECTED") {
  return status === "SHORTLISTED" ? ("NEXT_INTERVIEW" as const) : ("REJECT" as const);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user)) {
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  }

  const { id } = await context.params;
  try {
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    const [mapped, offer, reviews] = await Promise.all([
      mapEnterpriseApplication(application),
      getEnterpriseOfferForApplication(user, id),
      listInterviewReviews(user, id),
    ]);
    return NextResponse.json(
      { success: true, application: mapped, offer, reviews, jobId: application.jobId },
      { status: 200 },
    );
  } catch (error: unknown) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 0;
    if (status)
      return errorResponse(
        error instanceof Error ? error.message : "Không thể tải hồ sơ ứng viên.",
        status,
      );
    console.error(
      "[Enterprise Application GET] Database error:",
      error instanceof Error ? error.message : error,
    );
    return errorResponse("Không thể tải hồ sơ ứng viên.", 503);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originDenied = disallowedOriginResponse(req);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user)) {
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  }

  const raw = await req.json().catch(() => null);
  if (raw && typeof raw === "object" && "status" in raw && raw.status === "HIRED") {
    return errorResponse(
      "Không thể đánh dấu đã nhận việc trực tiếp. Hãy gửi đề nghị tuyển dụng và chờ ứng viên chấp nhận.",
      409,
    );
  }
  const parseResult = UpdateApplicationSchema.safeParse(raw);
  if (!parseResult.success) {
    return errorResponse(
      parseResult.error.errors[0]?.message ?? "Quyết định hồ sơ không hợp lệ.",
      400,
    );
  }

  const { id } = await context.params;
  const action =
    parseResult.data.action ??
    (parseResult.data.status ? mapLegacyStatus(parseResult.data.status) : null);
  if (!action) return errorResponse("Thiếu quyết định hồ sơ.", 400);

  try {
    const accessible = await findAccessibleApplication(user, id);
    if (!accessible)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "pipeline:write", accessible.job.company.id)))
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    const result = await decideApplication({
      user,
      applicationId: id,
      action,
      internalReason: parseResult.data.internalReason,
      candidateMessage: parseResult.data.candidateMessage,
      idempotencyKey: parseResult.data.idempotencyKey ?? req.headers.get("idempotency-key"),
    });
    const refreshed = await findAccessibleApplication(user, id);
    const mapped = refreshed ? await mapEnterpriseApplication(refreshed) : null;
    const offer = await getEnterpriseOfferForApplication(user, id);
    return NextResponse.json(
      {
        success: true,
        already: result.already,
        action: result.action,
        application: mapped,
        offer,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    try {
      rethrowHiringError(error);
    } catch (hiringError) {
      const status =
        hiringError && typeof hiringError === "object" && "status" in hiringError
          ? Number((hiringError as { status: number }).status)
          : 0;
      if (status)
        return errorResponse(
          hiringError instanceof Error
            ? hiringError.message
            : "Không thể cập nhật trạng thái hồ sơ.",
          status,
        );
    }
    console.error(
      "[Enterprise Application PATCH] Database error:",
      error instanceof Error ? error.message : error,
    );
    return errorResponse("Không thể cập nhật trạng thái hồ sơ.", 503);
  }
}
