import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { matchResumeToJob } from "@pivotassist/free-ai";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const BodySchema = z.object({ resumeId: z.string().min(1).optional() }).strict();

async function calculate(userId: string, jobId: string, resumeId?: string) {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      isPublished: true,
      archivedAt: null,
      company: { verificationStatus: "VERIFIED" },
    },
    include: { jobSkills: { include: { skill: { select: { name: true } } } } },
  });
  if (!job) return null;
  const resume = await prisma.resume.findFirst({
    where: { userId, ...(resumeId ? { id: resumeId } : { isActive: true }) },
    include: { fileAsset: { select: { filename: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (!resume) return { job, resume: null } as const;
  const requiredSkills = job.jobSkills
    .filter((item) => item.isRequired)
    .map((item) => item.skill.name);
  const niceToHaveSkills = job.jobSkills
    .filter((item) => !item.isRequired)
    .map((item) => item.skill.name);
  const score = matchResumeToJob({
    jobTitle: job.title,
    jobDescription: job.descriptionRaw,
    resumeText: resume.parsedText ?? "",
    requiredSkills,
    niceToHaveSkills,
  });
  const saved = await prisma.jobMatch.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: {
      userId,
      jobId,
      resumeId: resume.id,
      overallScore: score.overallScore,
      technicalScore: score.technicalScore,
      experienceScore: score.experienceScore,
      domainScore: score.domainScore,
      softSkillsScore: score.softSkillsScore,
      atsScore: score.atsCompatibilityScore,
      matchSummaryJson: score,
    },
    update: {
      resumeId: resume.id,
      overallScore: score.overallScore,
      technicalScore: score.technicalScore,
      experienceScore: score.experienceScore,
      domainScore: score.domainScore,
      softSkillsScore: score.softSkillsScore,
      atsScore: score.atsCompatibilityScore,
      matchSummaryJson: score,
    },
  });
  return { job, resume, score, saved };
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem điểm khớp.", 401);
  if (user.role !== "CANDIDATE") return errorResponse("Điểm khớp chỉ dành cho ứng viên.", 403);
  const { jobId } = await context.params;
  const url = new URL(request.url);
  try {
    const result = await calculate(
      user.userId,
      jobId,
      url.searchParams.get("resumeId") ?? undefined,
    );
    if (!result) return errorResponse("Tin tuyển dụng không tồn tại hoặc đã đóng.", 404);
    if (!result.resume)
      return errorResponse("Bạn cần tải CV trước khi tính điểm khớp.", 409, "RESUME_REQUIRED");
    return NextResponse.json({
      success: true,
      jobId,
      resumeId: result.resume.id,
      filename: result.resume.fileAsset.filename,
      score: result.score,
    });
  } catch (error) {
    console.error("[Match GET]", error);
    return errorResponse("Không thể tính điểm khớp.", 503);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để tính điểm khớp.", 401);
  if (user.role !== "CANDIDATE") return errorResponse("Điểm khớp chỉ dành cho ứng viên.", 403);
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Dữ liệu điểm khớp không hợp lệ.", 400);
  const { jobId } = await context.params;
  try {
    const result = await calculate(user.userId, jobId, parsed.data.resumeId);
    if (!result) return errorResponse("Tin tuyển dụng không tồn tại hoặc đã đóng.", 404);
    if (!result.resume)
      return errorResponse("Bạn cần tải CV trước khi tính điểm khớp.", 409, "RESUME_REQUIRED");
    await writeAuditLog(user, "job_match.calculated", jobId, {
      resumeId: result.resume.id,
      overallScore: result.score?.overallScore,
    });
    return NextResponse.json({
      success: true,
      jobId,
      resumeId: result.resume.id,
      score: result.score,
    });
  } catch (error) {
    console.error("[Match POST]", error);
    return errorResponse("Không thể tính điểm khớp.", 503);
  }
}
