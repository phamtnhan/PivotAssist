import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  accessibleApplicationWhere,
  ENTERPRISE_APPLICATION_LIST_SELECT,
  isEnterpriseUser,
  mapEnterpriseApplications,
} from "@/lib/enterprise-server";
import { errorResponse, paginationFromRequest } from "@/lib/server-utils";

// REQ-0035 — enterprise application list JSON omits candidatePhone

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");
  const status = url.searchParams.get("status");
  const query = (url.searchParams.get("q") ?? "").trim();
  const { page, pageSize, skip } = paginationFromRequest(request, { pageSize: 50 });
  try {
    const where = {
      ...accessibleApplicationWhere(user),
      ...(jobId ? { jobId } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(query
        ? { user: { OR: [{ fullName: { contains: query } }, { email: { contains: query } }] } }
        : {}),
    };
    const [applications, total] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: ENTERPRISE_APPLICATION_LIST_SELECT,
      }),
      prisma.application.count({ where }),
    ]);
    const mapped = (await mapEnterpriseApplications(applications)).sort(
      (a, b) => (b.interviewScore ?? -1) - (a.interviewScore ?? -1),
    );
    return NextResponse.json({
      success: true,
      applications: mapped,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Enterprise Applications GET]", error);
    return errorResponse("Không thể tải danh sách hồ sơ doanh nghiệp.", 503);
  }
}
