import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleOffer,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import {
  decideOfferApproval,
  requestOfferApprovals,
  rethrowHiringError,
  toEnterpriseOffer,
} from "@/lib/hiring-service";
import { errorResponse } from "@/lib/server-utils";

const RequestSchema = z
  .object({
    approverIds: z.array(z.string().min(1)).min(1).max(12),
    sequential: z.boolean().optional(),
  })
  .strict();

const DecideSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(2000).optional(),
  })
  .strict();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  try {
    const offerAccess = await findAccessibleOffer(user, id);
    if (!offerAccess)
      return errorResponse(
        "Đề nghị tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.",
        404,
      );
    if (!(await hasEnterpriseCapability(user, "offers:write", offerAccess.companyId)))
      return errorResponse("Thành viên INTERVIEWER không có quyền xử lý phê duyệt đề nghị.", 403);
    if (body && typeof body === "object" && "decision" in body) {
      const parsed = DecideSchema.safeParse(body);
      if (!parsed.success)
        return errorResponse(
          parsed.error.errors[0]?.message ?? "Quyết định duyệt không hợp lệ.",
          400,
        );
      const result = await decideOfferApproval({ user, offerId: id, ...parsed.data });
      return NextResponse.json({
        success: true,
        already: result.already,
        offer: toEnterpriseOffer(result.offer),
      });
    }
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success)
      return errorResponse(
        parsed.error.errors[0]?.message ?? "Danh sách người duyệt không hợp lệ.",
        400,
      );
    const offer = await requestOfferApprovals({ user, offerId: id, ...parsed.data });
    return NextResponse.json({ success: true, offer: toEnterpriseOffer(offer) }, { status: 201 });
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
          hiringError instanceof Error ? hiringError.message : "Không thể xử lý duyệt đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể xử lý duyệt đề nghị.", 503);
  }
}
