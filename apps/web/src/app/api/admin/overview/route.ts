import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xem được tổng quan hệ thống.", 403);
  try {
    const [
      users,
      candidates,
      recruiters,
      companies,
      jobs,
      applications,
      interviews,
      scored,
      paidSum,
      recentLogs,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { role: "CANDIDATE" } }),
      prisma.user.count({ where: { role: "RECRUITER" } }),
      prisma.company.count(),
      prisma.job.count({ where: { archivedAt: null } }),
      prisma.application.count(),
      prisma.interviewSession.count(),
      prisma.interviewScore.count({ where: { evaluationStatus: "READY" } }),
      prisma.billingInvoice.aggregate({ where: { status: "PAID" }, _sum: { amountVnd: true } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { fullName: true, email: true } } },
      }),
    ]);
    return NextResponse.json({
      success: true,
      metrics: {
        users,
        candidates,
        recruiters,
        companies,
        jobs,
        applications,
        interviews,
        scored,
        paidAmountVnd: paidSum._sum.amountVnd ?? 0,
      },
      recentLogs,
    });
  } catch (error) {
    console.error("[Admin Overview GET]", error);
    return errorResponse("Không thể tải tổng quan hệ thống.", 503);
  }
}
