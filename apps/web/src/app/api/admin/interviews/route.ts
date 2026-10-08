import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, paginationFromRequest } from "@/lib/server-utils";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xem được nhật ký phỏng vấn.", 403);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const { page, pageSize, skip } = paginationFromRequest(request, { pageSize: 50 });
  try {
    const where = q
      ? {
          OR: [
            { targetRole: { contains: q } },
            { user: { fullName: { contains: q } } },
            { user: { email: { contains: q } } },
          ],
        }
      : {};
    const [sessions, total] = await prisma.$transaction([
      prisma.interviewSession.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          targetRole: true,
          createdAt: true,
          durationSeconds: true,
          user: { select: { id: true, fullName: true, email: true } },
          job: { select: { title: true, company: { select: { name: true } } } },
          interviewScore: {
            select: {
              overallScore: true,
              starOverallScore: true,
              evaluationStatus: true,
              modelName: true,
            },
          },
        },
      }),
      prisma.interviewSession.count({ where }),
    ]);
    return NextResponse.json({
      success: true,
      interviews: sessions,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Admin Interviews GET]", error);
    return errorResponse("Không thể tải nhật ký phỏng vấn.", 503);
  }
}
