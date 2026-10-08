import { randomUUID } from "node:crypto";
import type { Prisma } from "@pivotassist/db";
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { GeminiRequestError, geminiProviderLabel } from "@/lib/gemini-server";
import { resolveInterviewQuestions, warmInterviewQuestionBank } from "@/lib/interview-questions";
import { remainingSessionCredits, asPreferences, toInputJsonValue } from "@/lib/user-preferences";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";
import {
  analyzeInterviewBlueprint,
  createInitialInterviewState,
  generateInitialQuestion,
} from "@pivotassist/contracts";

export const maxDuration = 180;

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const Schema = z
  .object({
    targetRole: z.string().trim().min(2).max(180),
    difficulty: z.enum(["junior", "mid", "senior", "lead"]).default("mid"),
    customJd: z.string().trim().max(20000).optional(),
    questionCount: z.number().int().min(3).max(20).default(8),
    language: z.enum(["vi", "en"]).default("vi"),
    useMasterCv: z.boolean().optional(),
  })
  .strict();

class SessionQuotaExhaustedError extends Error {
  constructor(message = "Bạn đã hết lượt luyện. Hãy mua thêm gói để tiếp tục.") {
    super(message);
    this.name = "SessionQuotaExhaustedError";
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để bắt đầu phiên luyện tập.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ tài khoản ứng viên mới có thể tạo phiên luyện tập.", 403);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Cấu hình phiên không hợp lệ.", 400);
  try {
    const resume =
      parsed.data.useMasterCv === false
        ? null
        : await prisma.resume.findFirst({
            where: { userId: user.userId, isActive: true },
            orderBy: { updatedAt: "desc" },
            select: { id: true, parsedText: true, fileAsset: { select: { filename: true } } },
          });
    const account = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { preferencesJson: true },
    });
    const credits = remainingSessionCredits(account?.preferencesJson);
    if (credits !== null && credits <= 0) {
      return errorResponse(
        "Bạn đã hết lượt luyện. Hãy mua thêm gói để tiếp tục.",
        402,
        "SESSION_QUOTA",
      );
    }
    const started = Date.now();
    const resolved = await resolveInterviewQuestions({
      jobTitle: parsed.data.targetRole,
      jobDescription: parsed.data.customJd ?? "",
      resumeText: resume?.parsedText ?? "",
      limit: parsed.data.questionCount,
      language: parsed.data.language,
      timeoutMs: 0,
    });
    const blueprint = analyzeInterviewBlueprint({
      targetRole: parsed.data.targetRole,
      jobDescription: parsed.data.customJd ?? "",
      resumeText: resume?.parsedText ?? "",
      difficulty: parsed.data.difficulty,
    });
    const initialQuestion = generateInitialQuestion(blueprint, parsed.data.language);
    // The question bank remains a recovery pool. The first live question is
    // selected from CV/JD evidence before any fixed bank is exposed to the room.
    const seededQuestions = resolved.questions.map((question, index) =>
      index === 0
        ? { ...question, prompt: initialQuestion.prompt, category: initialQuestion.category }
        : question,
    );
    const prompts = seededQuestions.map((question) => question.prompt);
    const initialState = createInitialInterviewState(blueprint, {
      remainingTimeMs: 20 * 60_000,
      maxTurns: 20,
    });
    const session = await prisma.$transaction(async (tx) => {
      // Row lock on User to prevent concurrent credit race conditions (FINDING-04)
      const lockedRows = await tx.$queryRaw<Array<{ preferencesJson: unknown }>>`
        SELECT preferencesJson FROM \`User\` WHERE id = ${user.userId} FOR UPDATE
      `;
      const lockedRow = lockedRows[0];
      const freshCredits = remainingSessionCredits(lockedRow?.preferencesJson);
      if (freshCredits !== null && freshCredits <= 0) {
        throw new SessionQuotaExhaustedError(
          "Bạn đã hết lượt luyện. Hãy mua thêm gói để tiếp tục.",
        );
      }

      if (freshCredits !== null) {
        const prefs = asPreferences(lockedRow?.preferencesJson);
        await tx.user.update({
          where: { id: user.userId },
          data: {
            preferencesJson: toInputJsonValue({ ...prefs, remainingSessions: freshCredits - 1 }),
          },
        });
      }

      const contextJson = {
        provider: resolved.provider,
        evaluationProvider: geminiProviderLabel(),
        language: parsed.data.language,
        job: {
          title: parsed.data.targetRole,
          description: (parsed.data.customJd ?? "").slice(0, 4000),
        },
        resume: resume
          ? {
              id: resume.id,
              filename: resume.fileAsset.filename,
              parsedText: (resume.parsedText ?? "").slice(0, 6000),
            }
          : null,
        adaptiveState: initialState,
      };
      const created = await tx.interviewSession.create({
        data: {
          userId: user.userId,
          targetRole: parsed.data.targetRole,
          difficulty: parsed.data.difficulty,
          status: "CALIBRATING",
          livekitRoomName: `practice_${randomUUID().slice(0, 10)}`,
          isVoiceOnly: true,
          contextJson: asJsonValue(contextJson),
        },
        select: {
          id: true,
          userId: true,
          targetRole: true,
          difficulty: true,
          status: true,
          livekitRoomName: true,
          isVoiceOnly: true,
          durationSeconds: true,
        },
      });
      const firstQuestion = await tx.interviewQuestion.create({
        data: {
          sessionId: created.id,
          orderIndex: seededQuestions[0]?.order ?? 1,
          category: seededQuestions[0]?.category ?? initialQuestion.category,
          prompt: seededQuestions[0]?.prompt ?? initialQuestion.prompt,
          keyTakeawaysJson: seededQuestions[0]?.targetSkills ?? [],
        },
        select: { id: true },
      });
      if (seededQuestions.length > 1) {
        await tx.interviewQuestion.createMany({
          data: seededQuestions
            .slice(1)
            .map((question) => ({
              sessionId: created.id,
              orderIndex: question.order,
              category: question.category,
              prompt: question.prompt,
              keyTakeawaysJson: question.targetSkills,
            })),
        });
      }
      const persistedState = {
        ...initialState,
        currentQuestionId: firstQuestion.id,
        currentAssistantTurnId: `question:${firstQuestion.id}`,
        askedQuestions: [
          {
            questionId: firstQuestion.id,
            turnId: `question:${firstQuestion.id}`,
            prompt: seededQuestions[0]?.prompt ?? initialQuestion.prompt,
            competency: initialQuestion.competency,
            action: "INITIAL" as const,
          },
        ],
      };
      await tx.interviewSession.update({
        where: { id: created.id },
        data: { contextJson: asJsonValue({ ...contextJson, adaptiveState: persistedState }) },
      });
      return created;
    });
    after(() => {
      void writeAuditLog(user, "practice_session.created", session.id, {
        targetRole: parsed.data.targetRole,
        questionProvider: resolved.provider,
      });
      warmInterviewQuestionBank({
        jobTitle: parsed.data.targetRole,
        jobDescription: parsed.data.customJd ?? "",
        resumeText: resume?.parsedText ?? "",
        limit: parsed.data.questionCount,
        language: parsed.data.language,
      });
    });
    console.info("[Practice Session]", {
      ms: Date.now() - started,
      provider: resolved.provider,
      questions: prompts.length,
    });
    return NextResponse.json(
      {
        success: true,
        session: {
          id: session.id,
          userId: session.userId,
          targetRole: session.targetRole,
          difficulty: session.difficulty,
          status: session.status,
          livekitRoomName: session.livekitRoomName,
          isVoiceOnly: session.isVoiceOnly,
          durationSeconds: session.durationSeconds,
        },
        firstQuestion: prompts[0] ?? null,
        questions: prompts,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SessionQuotaExhaustedError) {
      return errorResponse(error.message, 402, "SESSION_QUOTA");
    }
    console.error("[Practice Session POST]", error);
    if (error instanceof GeminiRequestError)
      return errorResponse(error.message, 503, "GEMINI_FAILED");
    return errorResponse("Không thể tạo phiên luyện tập.", 503);
  }
}
