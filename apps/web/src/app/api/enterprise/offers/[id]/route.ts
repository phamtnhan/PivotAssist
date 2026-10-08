import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleOffer,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { rethrowHiringError, updateOffer } from "@/lib/hiring-service";
import { errorResponse } from "@/lib/server-utils";

const Schema = z
  .object({
    title: z.string().trim().min(2).max(180).optional(),
    employmentType: z.string().trim().min(2).max(40).optional(),
    compensationAmount: z.number().int().min(0).max(1_000_000_000_000).optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    startDate: z.string().datetime().nullable().optional(),
    location: z.string().trim().max(180).nullable().optional(),
    benefits: z.string().trim().max(4000).nullable().optional(),
    terms: z.string().trim().max(8000).nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Dữ liệu đề nghị không hợp lệ.", 400);
  const { id } = await context.params;
  try {
    const offerAccess = await findAccessibleOffer(user, id);
    if (!offerAccess)
      return errorResponse(
        "Đề nghị tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.",
        404,
      );
    if (!(await hasEnterpriseCapability(user, "offers:write", offerAccess.companyId)))
      return errorResponse("Thành viên INTERVIEWER không có quyền sửa đề nghị tuyển dụng.", 403);
    const offer = await updateOffer({ user, offerId: id, ...parsed.data });
    return NextResponse.json({ success: true, offer });
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
          hiringError instanceof Error ? hiringError.message : "Không thể cập nhật đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể cập nhật đề nghị.", 503);
  }
}
