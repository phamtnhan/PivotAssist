import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleOffer,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { rethrowHiringError, toEnterpriseOffer, withdrawOffer } from "@/lib/hiring-service";
import { errorResponse } from "@/lib/server-utils";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const offerAccess = await findAccessibleOffer(user, id);
    if (!offerAccess)
      return errorResponse(
        "Đề nghị tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.",
        404,
      );
    if (!(await hasEnterpriseCapability(user, "offers:write", offerAccess.companyId)))
      return errorResponse(
        "Thành viên INTERVIEWER không có quyền thu hồi đề nghị tuyển dụng.",
        403,
      );
    const offer = await withdrawOffer({ user, offerId: id });
    return NextResponse.json({ success: true, offer: toEnterpriseOffer(offer) });
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
          hiringError instanceof Error ? hiringError.message : "Không thể thu hồi đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể thu hồi đề nghị.", 503);
  }
}
