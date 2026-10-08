import { NextResponse } from "next/server";
import { getSessionUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";
import { isGarbageOrgName } from "@/lib/org-name";
import { mapStoredMatch, toPublicEmploymentType } from "@/lib/public-job";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await context.params;
  try {
    const job = await prisma.job.findFirst({
      where: {
        id,
        isPublished: true,
        archivedAt: null,
        company: { verificationStatus: "VERIFIED" },
      },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        jobSkills: {
          include: { skill: { select: { id: true, name: true, category: true, type: true } } },
        },
      },
    });
    if (!job || isGarbageOrgName(job.company.name)) {
      return errorResponse("Tin tuyển dụng không tồn tại hoặc đã đóng.", 404);
    }
    const stored =
      user?.role === "CANDIDATE"
        ? await prisma.jobMatch.findUnique({
            where: { userId_jobId: { userId: user.userId, jobId: job.id } },
            select: { overallScore: true, matchSummaryJson: true },
          })
        : null;
    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        companyName: job.company.name,
        companyLogoUrl: job.company.logoUrl ?? undefined,
        title: job.title,
        location: job.location,
        employmentType: toPublicEmploymentType(job.employmentType),
        salaryRange: job.salaryRange ?? undefined,
        hiringCount: job.hiringCount,
        department: job.department ?? undefined,
        postedAt: job.createdAt.toISOString(),
        sourceUrl: job.sourceUrl ?? `/jobs?jobId=${encodeURIComponent(job.id)}`,
        descriptionHtml: job.descriptionRaw,
        requiredSkills: job.jobSkills.filter((item) => item.isRequired).map((item) => item.skill),
        niceToHaveSkills: job.jobSkills
          .filter((item) => !item.isRequired)
          .map((item) => item.skill),
        matchScorecard: mapStoredMatch(stored),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : error;
    console.error("[Jobs GET id] Database error:", message);
    return errorResponse("Không thể tải tin tuyển dụng.", 503);
  }
}
