import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleApplication,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import {
  decideApplication,
  getEnterpriseOfferForApplication,
  rethrowHiringError,
} from "@/lib/hiring-service";
import { errorResponse } from "@/lib/server-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const offer = await getEnterpriseOfferForApplication(user, id);
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
          hiringError instanceof Error ? hiringError.message : "Không thể tải đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể tải đề nghị.", 503);
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "offers:write", application.job.company.id)))
      return errorResponse("Thành viên INTERVIEWER không có quyền tạo đề nghị tuyển dụng.", 403);
    const result = await decideApplication({ user, applicationId: id, action: "PROCEED_TO_OFFER" });
    const offer = await getEnterpriseOfferForApplication(user, id);
    return NextResponse.json(
      { success: true, already: result.already, offer },
      { status: result.already ? 200 : 201 },
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
          hiringError instanceof Error ? hiringError.message : "Không thể tạo đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể tạo đề nghị.", 503);
  }
}
