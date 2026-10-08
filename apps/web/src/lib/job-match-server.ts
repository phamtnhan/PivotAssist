import { matchResumeToJob, type JobMatchResult } from "@pivotassist/free-ai";
import { prisma } from "@pivotassist/db";

export async function persistJobMatch(input: {
  userId: string;
  jobId: string;
  resumeId?: string | null;
}): Promise<JobMatchResult | null> {
  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    include: { jobSkills: { include: { skill: true } } },
  });
  const resume = input.resumeId
    ? await prisma.resume.findUnique({
        where: { id: input.resumeId },
        select: { id: true, parsedText: true },
      })
    : await prisma.resume.findFirst({
        where: { userId: input.userId, isActive: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, parsedText: true },
      });
  if (!job || !resume) return null;

  const requiredSkills = job.jobSkills
    .filter((item) => item.isRequired)
    .map((item) => item.skill.name);
  const niceToHaveSkills = job.jobSkills
    .filter((item) => !item.isRequired)
    .map((item) => item.skill.name);
  const match = matchResumeToJob({
    jobTitle: job.title,
    jobDescription: job.descriptionRaw,
    resumeText: resume.parsedText ?? "",
    requiredSkills,
    niceToHaveSkills,
  });

  await prisma.jobMatch.upsert({
    where: { userId_jobId: { userId: input.userId, jobId: input.jobId } },
    create: {
      userId: input.userId,
      jobId: input.jobId,
      resumeId: resume.id,
      overallScore: match.overallScore,
      technicalScore: match.technicalScore,
      experienceScore: match.experienceScore,
      domainScore: match.domainScore,
      softSkillsScore: match.softSkillsScore,
      atsScore: match.atsCompatibilityScore,
      matchSummaryJson: JSON.parse(JSON.stringify(match)),
    },
    update: {
      resumeId: resume.id,
      overallScore: match.overallScore,
      technicalScore: match.technicalScore,
      experienceScore: match.experienceScore,
      domainScore: match.domainScore,
      softSkillsScore: match.softSkillsScore,
      atsScore: match.atsCompatibilityScore,
      matchSummaryJson: JSON.parse(JSON.stringify(match)),
    },
  });

  return match;
}
