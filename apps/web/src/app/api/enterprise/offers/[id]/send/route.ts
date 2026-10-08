// REQ-0027 — Origin check on cookie-mutating offer send
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  findAccessibleOffer,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { rethrowHiringError, sendOffer, toEnterpriseOffer } from "@/lib/hiring-service";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse } from "@/lib/server-utils";

const Schema = z.object({ expiresAt: z.string().datetime().nullable().optional() }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Hạn đề nghị không hợp lệ.", 400);
  const { id } = await context.params;
  try {
    const offerAccess = await findAccessibleOffer(user, id);
    if (!offerAccess)
      return errorResponse(
        "Đề nghị tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.",
        404,
      );
    if (!(await hasEnterpriseCapability(user, "offers:write", offerAccess.companyId)))
      return errorResponse("Thành viên INTERVIEWER không có quyền gửi đề nghị tuyển dụng.", 403);
    const offer = await sendOffer({ user, offerId: id, expiresAt: parsed.data.expiresAt });
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
          hiringError instanceof Error ? hiringError.message : "Không thể gửi đề nghị.",
          status,
        );
    }
    return errorResponse("Không thể gửi đề nghị.", 503);
  }
}
