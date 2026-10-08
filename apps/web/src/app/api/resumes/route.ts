import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { extractResumeForParse, parseResumeForStorage, safeFileName } from "@/lib/free-ai-server";
import { deleteLocalFile } from "@/lib/local-file-storage";
import { persistJobMatch } from "@/lib/job-match-server";
import { mergePreferences, toInputJsonValue } from "@/lib/user-preferences";
import { resumeDerivedReplacePolicy } from "@/lib/resume-derived";
import { RESUME_MAX_BYTES, SUPPORTED_RESUME_LABEL } from "@/lib/resume-formats";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

export const runtime = "nodejs";

const JsonResumeSchema = z.object({
  filename: z.string().trim().min(1).max(180).default("resume.txt"),
  mimeType: z.string().trim().max(120).default("text/plain"),
  text: z.string().trim().min(20, "Nội dung CV cần có ít nhất 20 ký tự."),
});

function serializeResume(resume: {
  id: string;
  fileAssetId: string;
  isActive: boolean;
  parsedText: string | null;
  rawJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  fileAsset: { filename: string; mimeType: string; fileSizeBytes: bigint; fileKey: string };
}) {
  return {
    id: resume.id,
    fileAssetId: resume.fileAssetId,
    filename: resume.fileAsset.filename,
    mimeType: resume.fileAsset.mimeType,
    fileSizeBytes: resume.fileAsset.fileSizeBytes.toString(),
    fileKey: resume.fileAsset.fileKey,
    isActive: resume.isActive,
    parsedText: resume.parsedText,
    parsed: resume.rawJson,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

const resumeInclude = {
  fileAsset: { select: { filename: true, mimeType: true, fileSizeBytes: true, fileKey: true } },
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem CV.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ tài khoản ứng viên mới có CV cá nhân.", 403);

  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: user.userId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include: resumeInclude,
    });
    return NextResponse.json({ success: true, resumes: resumes.map(serializeResume) });
  } catch (error) {
    console.error("[Resumes GET]", error);
    return errorResponse("Không thể tải danh sách CV.", 503);
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để tải CV.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ tài khoản ứng viên mới có thể tải CV.", 403);

  let filename = "resume.txt";
  let mimeType = "text/plain";
  let providedText: string | undefined;
  let fileBuffer: Buffer;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return errorResponse("Vui lòng chọn file CV.", 400);
      filename = file.name || filename;
      mimeType =
        file.type || (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain");
      if (file.size > RESUME_MAX_BYTES) return errorResponse("CV không được vượt quá 15MB.", 413);
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const parsed = JsonResumeSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success)
        return errorResponse(parsed.error.errors[0]?.message ?? "Dữ liệu CV không hợp lệ.", 400);
      filename = parsed.data.filename;
      mimeType = parsed.data.mimeType;
      providedText = parsed.data.text;
      fileBuffer = Buffer.from(providedText, "utf8");
    }

    const normalizedFilename = safeFileName(filename);
    const extracted = await extractResumeForParse(
      fileBuffer,
      mimeType,
      normalizedFilename,
      providedText,
    );
    if (extracted.text.length < 20) {
      return errorResponse(
        extracted.warnings[0] ??
          `Không thể đọc nội dung CV (${extracted.engine}). Hỗ trợ: ${SUPPORTED_RESUME_LABEL}.`,
        422,
      );
    }
    const parsedResume = parseResumeForStorage(extracted.text, normalizedFilename);
    const fileKey = `local:uploads/resumes/${user.userId}/${randomUUID()}-${normalizedFilename}`;
    const relativePath = fileKey.slice("local:".length);
    const absolutePath = path.join(process.cwd(), ".data", relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fileBuffer);

    let resume;
    try {
      resume = await prisma.$transaction(async (tx) => {
        await tx.resume.updateMany({ where: { userId: user.userId }, data: { isActive: false } });
        const asset = await tx.fileAsset.create({
          data: {
            userId: user.userId,
            fileKey,
            filename: normalizedFilename,
            mimeType,
            fileSizeBytes: BigInt(fileBuffer.byteLength),
            purpose: "RESUME_PDF",
          },
        });
        const created = await tx.resume.create({
          data: {
            userId: user.userId,
            fileAssetId: asset.id,
            parsedText: parsedResume.parsedText,
            rawJson: parsedResume.rawJson,
            isActive: true,
          },
          include: resumeInclude,
        });
        const profile = await tx.profile.findUnique({
          where: { userId: user.userId },
          select: {
            currentJobTitle: true,
            targetJobTitle: true,
            yearsOfExperience: true,
            bio: true,
            phone: true,
            location: true,
          },
        });
        const parsedTitle = (parsedResume.parsed.currentJobTitle || "").slice(0, 180) || null;
        await tx.profile.upsert({
          where: { userId: user.userId },
          create: {
            userId: user.userId,
            currentJobTitle: parsedTitle,
            targetJobTitle: parsedTitle,
            yearsOfExperience: parsedResume.parsed.yearsOfExperience,
            bio: parsedResume.parsed.summary.slice(0, 4000) || null,
            phone: (parsedResume.parsed.phone || "").slice(0, 40) || null,
            location: (parsedResume.parsed.location || "").slice(0, 180) || null,
          },
          update: {
            currentJobTitle: parsedTitle || profile?.currentJobTitle || undefined,
            targetJobTitle: parsedTitle || profile?.targetJobTitle || undefined,
            yearsOfExperience: parsedResume.parsed.yearsOfExperience || profile?.yearsOfExperience,
            bio: parsedResume.parsed.summary.slice(0, 4000) || profile?.bio || undefined,
            phone: parsedResume.parsed.phone || profile?.phone || undefined,
            location: parsedResume.parsed.location || profile?.location || undefined,
          },
        });
        const replacePolicy = resumeDerivedReplacePolicy(parsedResume.parsed);
        if (replacePolicy.updateFullName || replacePolicy.replaceExperiences) {
          const currentUser = await tx.user.findUnique({
            where: { id: user.userId },
            select: { fullName: true, preferencesJson: true },
          });
          await tx.user.update({
            where: { id: user.userId },
            data: {
              fullName:
                (replacePolicy.updateFullName
                  ? parsedResume.parsed.fullName
                  : currentUser?.fullName) || undefined,
              preferencesJson: toInputJsonValue(
                mergePreferences(currentUser?.preferencesJson, {
                  cvParserEngine: extracted.engine,
                  ...(replacePolicy.replaceExperiences
                    ? {
                        experiences: parsedResume.parsed.experiences.map((item, index) => ({
                          id: `cv_${index + 1}`,
                          role: item.role,
                          company: item.company,
                          period: item.period,
                          description: item.bullets,
                        })),
                      }
                    : {}),
                }),
              ),
            },
          });
        }
        if (replacePolicy.replaceSkills) {
          await tx.userSkill.deleteMany({ where: { userId: user.userId } });
          for (const name of parsedResume.parsed.extractedSkills) {
            const skill = await tx.skill.upsert({
              where: { name },
              create: { name, category: "CV_PARSED", type: "HARD" },
              update: { category: "CV_PARSED" },
            });
            await tx.userSkill.create({
              data: {
                userId: user.userId,
                skillId: skill.id,
                status: "PROFICIENT",
                levelScore: 80,
              },
            });
          }
        }
        return created;
      });
    } catch (transactionError) {
      await deleteLocalFile(fileKey).catch(() => null);
      throw transactionError;
    }

    await writeAuditLog(user, "resume.created", resume.id, {
      filename: normalizedFilename,
      extractedSkills: parsedResume.parsed.extractedSkills,
      engine: extracted.engine,
    });
    const applications = await prisma.application.findMany({
      where: { userId: user.userId },
      select: { jobId: true },
    });
    await Promise.all(
      applications.map((application) =>
        persistJobMatch({
          userId: user.userId,
          jobId: application.jobId,
          resumeId: resume.id,
        }).catch(() => null),
      ),
    );
    return NextResponse.json(
      {
        success: true,
        resume: serializeResume(resume),
        parser: {
          engine: extracted.engine,
          warnings: extracted.warnings,
          extractedChars: extracted.text.length,
          skills: parsedResume.parsed.extractedSkills,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[Resumes POST]", error?.message ?? error);
    return errorResponse("Không thể lưu CV. Vui lòng thử lại.", 503);
  }
}
