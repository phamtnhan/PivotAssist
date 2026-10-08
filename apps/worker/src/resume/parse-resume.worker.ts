import { Job } from "bullmq";
import { parseResumeText } from "@pivotassist/free-ai";
import { prisma } from "@pivotassist/db";

export interface ParseResumeJobData {
  resumeId: string;
  fileAssetId: string;
  userId: string;
}

export async function processResumeParse(job: Job<ParseResumeJobData>) {
  const { resumeId, userId } = job.data;
  console.log(`[Worker] Starting CV parsing for resumeId=${resumeId}, userId=${userId}`);
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    select: { id: true, parsedText: true, fileAsset: { select: { filename: true } } },
  });
  if (!resume) throw new Error(`Resume ${resumeId} not found`);

  const parsedText = resume.parsedText?.trim() || "CV chưa có nội dung text để phân tích.";
  const parsed = parseResumeText(parsedText, resume.fileAsset.filename);
  await prisma.resume.update({ where: { id: resumeId }, data: { parsedText, rawJson: parsed } });
  console.log(
    `[Worker] Completed CV parsing for resumeId=${resumeId}, skills=${parsed.extractedSkills.length}`,
  );
  return { success: true, extractedSkillsCount: parsed.extractedSkills.length };
}
