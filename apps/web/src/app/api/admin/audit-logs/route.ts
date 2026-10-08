import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, paginationFromRequest } from "@/lib/server-utils";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xem được nhật ký hệ thống.", 403);
  const { page, pageSize, skip } = paginationFromRequest(request, { pageSize: 100 });
  try {
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { user: { select: { fullName: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    return NextResponse.json({
      success: true,
      logs,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Admin Audit GET]", error);
    return errorResponse("Không thể tải nhật ký hệ thống.", 503);
  }
}
