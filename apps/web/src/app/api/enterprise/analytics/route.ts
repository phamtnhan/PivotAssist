import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  accessibleApplicationWhere,
  accessibleJobWhere,
  requireEnterpriseUser,
} from "@/lib/enterprise-server";
import { errorResponse } from "@/lib/server-utils";

export async function GET() {
  const user = await requireEnterpriseUser(await getCurrentUser());
  if (!user) return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  try {
    const appWhere = accessibleApplicationWhere(user);
    const interviewWhere = user.role === "ADMIN" ? {} : { job: { is: accessibleJobWhere(user) } };
    const [applications, completed, shortlisted, scheduled, hired, interviews, scores] =
      await prisma.$transaction([
        prisma.application.count({ where: appWhere }),
        prisma.application.count({ where: { ...appWhere, status: "AI_INTERVIEW_COMPLETED" } }),
        prisma.application.count({ where: { ...appWhere, status: "SHORTLISTED" } }),
        prisma.application.count({ where: { ...appWhere, status: "FACE_TO_FACE_SCHEDULED" } }),
        prisma.application.count({ where: { ...appWhere, status: "HIRED" } }),
        prisma.interviewSession.count({ where: interviewWhere }),
        prisma.interviewScore.findMany({
          where: { session: interviewWhere },
          select: { overallScore: true },
        }),
      ]);
    const averageScore = scores.length
      ? Math.round(scores.reduce((sum, score) => sum + score.overallScore, 0) / scores.length)
      : 0;
    const skillFeedback = await prisma.interviewFeedback
      .groupBy({
        by: ["targetSkill"],
        where: { session: interviewWhere },
        _count: { targetSkill: true },
      })
      .catch(() => []);
    const skillGaps = [...skillFeedback]
      .sort((a, b) => b._count.targetSkill - a._count.targetSkill)
      .slice(0, 6)
      .map((item) => ({
        skill: item.targetSkill,
        count: item._count.targetSkill,
        gapCount: item._count.targetSkill,
      }));
    return NextResponse.json({
      success: true,
      metrics: { applications, completed, shortlisted, scheduled, hired, interviews, averageScore },
      funnel: [
        { stage: "received", count: applications },
        { stage: "ai", count: completed },
        { stage: "selected", count: shortlisted },
        { stage: "room", count: scheduled },
        { stage: "hired", count: hired },
      ],
      skillGaps,
    });
  } catch (error) {
    console.error("[Enterprise Analytics GET]", error);
    return errorResponse("Không thể tải số liệu doanh nghiệp.", 503);
  }
}
