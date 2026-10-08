import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@pivotassist/db";
import { getCurrentUser, prisma } from "@/lib/auth";
import { GeminiRequestError, geminiProviderLabel } from "@/lib/gemini-server";
import { resolveInterviewQuestions, warmInterviewQuestionBank } from "@/lib/interview-questions";
import { errorResponse } from "@/lib/server-utils";
import {
  analyzeInterviewBlueprint,
  createInitialInterviewState,
  generateInitialQuestion,
} from "@pivotassist/contracts";

export const maxDuration = 180;

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const StartInterviewSchema = z.object({
  targetRole: z.string().min(1).optional(),
  difficulty: z.enum(["junior", "mid", "senior", "lead"]).default("senior"),
  questionCount: z.number().int().min(3).max(20).default(8),
  language: z.enum(["vi", "en"]).default("vi"),
});

function serializeSession(session: Record<string, unknown>) {
  const { contextJson, ...rest } = session;
  void contextJson;
  return rest;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để bắt đầu phỏng vấn AI.", 401);

  const { id: applicationId } = await context.params;
  const parseResult = StartInterviewSchema.safeParse(await req.json().catch(() => ({})));
  if (!parseResult.success) {
    return errorResponse(
      parseResult.error.errors[0]?.message ?? "Cấu hình buổi luyện không hợp lệ.",
      400,
    );
  }

  try {
    const [application, existingSession] = await Promise.all([
      prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              descriptionRaw: true,
              rubricJson: true,
              interviewQuestionsJson: true,
            },
          },
          resume: {
            select: { id: true, parsedText: true, fileAsset: { select: { filename: true } } },
          },
        },
      }),
      prisma.interviewSession.findFirst({
        where: { applicationId, status: { in: ["CALIBRATING", "IN_PROGRESS", "PROCESSING"] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          livekitRoomName: true,
          status: true,
          applicationId: true,
          userId: true,
          jobId: true,
          targetRole: true,
          difficulty: true,
          durationSeconds: true,
          isVoiceOnly: true,
        },
      }),
    ]);
    if (!application) return errorResponse("Hồ sơ không tồn tại.", 404);
    if (application.userId !== user.userId)
      return errorResponse("Bạn không có quyền truy cập hồ sơ này.", 403);
    if (["HIRED", "REJECTED", "WITHDRAWN"].includes(application.status)) {
      return errorResponse("Hồ sơ đã đóng và không thể bắt đầu phỏng vấn mới.", 409);
    }
    if (application.status === "OFFER_PENDING") {
      return errorResponse("Hồ sơ đang ở bước đề nghị tuyển dụng.", 409);
    }
    if (!application.resume)
      return errorResponse(
        "Hồ sơ chưa có CV. Hãy tải CV trước khi bắt đầu phỏng vấn.",
        409,
        "RESUME_REQUIRED",
      );
    if (existingSession)
      return NextResponse.json(
        { success: true, session: serializeSession(existingSession), reused: true },
        { status: 200 },
      );

    const previous = await prisma.interviewSession.findFirst({
      where: { applicationId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, roundIndex: true },
    });

    const resolved = await resolveInterviewQuestions({
      jobTitle: application.job.title,
      jobDescription: application.job.descriptionRaw,
      resumeText: application.resume?.parsedText ?? "",
      configuredQuestions: Array.isArray(application.job.interviewQuestionsJson)
        ? application.job.interviewQuestionsJson.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      limit: parseResult.data.questionCount,
      language: parseResult.data.language,
      timeoutMs: 0,
    });
    const employerRubric = Array.isArray(application.job.rubricJson)
      ? application.job.rubricJson.filter(
          (item): item is { label: string; weight?: number; description?: string } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { label?: unknown }).label === "string",
        )
      : [];
    const blueprint = analyzeInterviewBlueprint({
      targetRole: parseResult.data.targetRole ?? application.job.title,
      jobDescription: application.job.descriptionRaw,
      resumeText: application.resume?.parsedText ?? "",
      rubric: employerRubric,
      difficulty: parseResult.data.difficulty,
    });
    const initialQuestion = generateInitialQuestion(blueprint, parseResult.data.language);
    const hasConfiguredQuestions =
      Array.isArray(application.job.interviewQuestionsJson) &&
      application.job.interviewQuestionsJson.some(
        (item) => typeof item === "string" && item.trim(),
      );
    const questions = resolved.questions.map((question, index) =>
      index === 0 && !hasConfiguredQuestions
        ? { ...question, prompt: initialQuestion.prompt, category: initialQuestion.category }
        : question,
    );
    const prompts = questions.map((question) => question.prompt);
    const initialState = createInitialInterviewState(blueprint, {
      remainingTimeMs: 20 * 60_000,
      maxTurns: 20,
    });
    const session = await prisma.$transaction(async (tx) => {
      const contextJson = {
        provider: resolved.provider,
        evaluationProvider: geminiProviderLabel(),
        ...(application.job.id === "seed_job_demo_interview"
          ? { demoFixedQuestions: questions.map((question) => question.prompt) }
          : {}),
        job: {
          id: application.job.id,
          title: application.job.title,
          description: application.job.descriptionRaw.slice(0, 4000),
          rubric: employerRubric,
        },
        resume: application.resume
          ? {
              id: application.resume.id,
              filename: application.resume.fileAsset.filename,
              parsedText: (application.resume.parsedText ?? "").slice(0, 6000),
            }
          : null,
        language: parseResult.data.language,
        adaptiveState: initialState,
      };
      const created = await tx.interviewSession.create({
        data: {
          userId: user.userId,
          jobId: application.jobId,
          applicationId,
          targetRole: parseResult.data.targetRole ?? application.job.title,
          difficulty: parseResult.data.difficulty,
          contextJson: asJsonValue(contextJson),
          status: "CALIBRATING",
          livekitRoomName: `application_${applicationId}_${randomUUID().slice(0, 8)}`,
          isVoiceOnly: true,
          startedAt: new Date(),
          kind: "AI",
          roundIndex: (previous?.roundIndex ?? 0) + 1,
          previousSessionId: previous?.id ?? null,
        },
        select: {
          id: true,
          livekitRoomName: true,
          status: true,
          applicationId: true,
          userId: true,
          jobId: true,
          targetRole: true,
          difficulty: true,
          durationSeconds: true,
          isVoiceOnly: true,
        },
      });
      const firstQuestion = await tx.interviewQuestion.create({
        data: {
          sessionId: created.id,
          orderIndex: questions[0]?.order ?? 1,
          category: questions[0]?.category ?? initialQuestion.category,
          prompt: questions[0]?.prompt ?? initialQuestion.prompt,
          keyTakeawaysJson: questions[0]?.targetSkills ?? [],
        },
        select: { id: true },
      });
      if (questions.length > 1) {
        await tx.interviewQuestion.createMany({
          data: questions.slice(1).map((question) => ({
            sessionId: created.id,
            orderIndex: question.order,
            category: question.category,
            prompt: question.prompt,
            keyTakeawaysJson: question.targetSkills,
          })),
        });
      }
      await tx.interviewSession.update({
        where: { id: created.id },
        data: {
          contextJson: asJsonValue({
            ...contextJson,
            adaptiveState: {
              ...initialState,
              currentQuestionId: firstQuestion.id,
              currentAssistantTurnId: `question:${firstQuestion.id}`,
              askedQuestions: [
                {
                  questionId: firstQuestion.id,
                  turnId: `question:${firstQuestion.id}`,
                  prompt: questions[0]?.prompt ?? initialQuestion.prompt,
                  competency: blueprint.competencies[0]?.id ?? initialQuestion.competency,
                  action: "INITIAL" as const,
                },
              ],
            },
          }),
        },
      });
      const keepPipeline = [
        "HOLD",
        "ADDITIONAL_ASSESSMENT",
        "SHORTLISTED",
        "FACE_TO_FACE_SCHEDULED",
        "OFFER_PENDING",
      ].includes(application.status);
      if (!keepPipeline) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: "AI_INTERVIEW_IN_PROGRESS" },
        });
      }
      return created;
    });
    after(() => {
      warmInterviewQuestionBank({
        jobTitle: application.job.title,
        jobDescription: application.job.descriptionRaw,
        resumeText: application.resume?.parsedText ?? "",
        limit: parseResult.data.questionCount,
        language: parseResult.data.language,
      });
    });
    return NextResponse.json(
      {
        success: true,
        session: serializeSession(session),
        firstQuestion: prompts[0] ?? null,
        questions: prompts,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[Application Interview POST] Database error:", error?.message);
    if (error instanceof GeminiRequestError) {
      return errorResponse(error.message, 503, "GEMINI_FAILED");
    }
    return errorResponse("Không thể khởi tạo phỏng vấn AI cho hồ sơ này.", 503);
  }
}
