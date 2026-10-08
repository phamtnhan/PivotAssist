import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { findAccessibleJob, isEnterpriseUser, mapEnterpriseJobs } from "@/lib/enterprise-server";
import { errorResponse } from "@/lib/server-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const job = await findAccessibleJob(user, id);
    if (!job)
      return errorResponse("Tin tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.", 404);
    const [mapped] = await mapEnterpriseJobs([job]);
    const ranked = (mapped?.applications ?? [])
      .filter((application) => typeof application.interviewScore === "number")
      .sort((a, b) => (b.interviewScore ?? -1) - (a.interviewScore ?? -1));
    return NextResponse.json({
      success: true,
      jobId: id,
      ranking: ranked.map((application, index) => ({
        rank: index + 1,
        ...application,
        cvContext: {
          match: application.cvMatch ?? null,
          summary: application.cvSummary ?? null,
          skills: application.cvSkills ?? [],
        },
      })),
    });
  } catch (error) {
    console.error("[Enterprise Ranking GET]", error);
    return errorResponse("Không thể tải bảng xếp hạng của tin.", 503);
  }
}
