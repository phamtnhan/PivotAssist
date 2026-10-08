// REQ-0005 — heuristic on hot path; Gemini only inside after()
// REQ-0022 — complete uses DB-fresh getCurrentUser
// REQ-0027 — Origin check
// REQ-0029 — per-user complete throttle
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evaluateInterview, type FreeInterviewEvaluation } from "@pivotassist/free-ai";
import {
  analyzeInterviewBlueprint,
  buildAdaptiveEvidenceReport,
  createInitialInterviewState,
  type InterviewState,
  type InterviewTranscriptTurn,
} from "@pivotassist/contracts";
import { getCurrentUser, prisma } from "@/lib/auth";
import { evaluateWithGemini } from "@/lib/gemini-server";
import { consumeKeyedLimit } from "@/lib/keyed-limit";
import { resumeTextFromSession, parseSessionContext } from "@/lib/interview-context";
import {
  parsePipelineStatus,
  pipelineAfterSessionComplete,
  recommendationFromScore,
} from "@/lib/hiring-pipeline";
import { notifyInterviewCompleted } from "@/lib/hiring-service";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const CompleteInterviewSchema = z
  .object({
    durationSeconds: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60)
      .optional(),
  })
  .strict();

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function persistEvaluation(input: {
  sessionId: string;
  applicationId: string | null;
  evaluation: FreeInterviewEvaluation;
  provider: string;
  narrativeStatus: string;
  questionEvalStatus: string;
  rubricJson: unknown;
  adaptiveReportJson: unknown;
}) {
  const persistQuestionEval =
    input.questionEvalStatus === "ok" || input.questionEvalStatus === "heuristic";
  await prisma.$transaction(async (tx) => {
    const visual = await tx.visualSummary.findUnique({
      where: { sessionId: input.sessionId },
      select: { overallScore: true },
    });
    const visualScore = visual?.overallScore ?? 0;
    await tx.interviewScore.upsert({
      where: { sessionId: input.sessionId },
      create: {
        sessionId: input.sessionId,
        overallScore: input.evaluation.overallScore,
        starOverallScore: input.evaluation.starOverallScore,
        technicalScore: input.evaluation.technicalScore,
        visualScore,
        strengthsJson: jsonValue(input.evaluation.strengths),
        improvementsJson: jsonValue(input.evaluation.improvements),
        evaluationStatus: "READY",
        narrativeStatus: input.narrativeStatus,
        questionEvalStatus: input.questionEvalStatus,
        modelName: input.provider,
        rubricJson: input.rubricJson ? jsonValue(input.rubricJson) : undefined,
        adaptiveReportJson: input.adaptiveReportJson
          ? jsonValue(input.adaptiveReportJson)
          : undefined,
        recommendation: recommendationFromScore(input.evaluation.overallScore),
        summaryText: [...input.evaluation.strengths, ...input.evaluation.improvements]
          .slice(0, 8)
          .join(" "),
      },
      update: {
        overallScore: input.evaluation.overallScore,
        starOverallScore: input.evaluation.starOverallScore,
        technicalScore: input.evaluation.technicalScore,
        visualScore,
        strengthsJson: jsonValue(input.evaluation.strengths),
        improvementsJson: jsonValue(input.evaluation.improvements),
        evaluationStatus: "READY",
        narrativeStatus: input.narrativeStatus,
        questionEvalStatus: input.questionEvalStatus,
        modelName: input.provider,
        rubricJson: input.rubricJson ? jsonValue(input.rubricJson) : undefined,
        adaptiveReportJson: input.adaptiveReportJson
          ? jsonValue(input.adaptiveReportJson)
          : undefined,
        recommendation: recommendationFromScore(input.evaluation.overallScore),
        summaryText: [...input.evaluation.strengths, ...input.evaluation.improvements]
          .slice(0, 8)
          .join(" "),
      },
    });
    await tx.interviewFeedback.deleteMany({ where: { sessionId: input.sessionId } });
    if (input.evaluation.feedback.length > 0) {
      await tx.interviewFeedback.createMany({
        data: input.evaluation.feedback.map((item) => ({ sessionId: input.sessionId, ...item })),
      });
    }
    if (persistQuestionEval) {
      for (const questionScore of input.evaluation.questionScores) {
        await tx.interviewQuestion.update({
          where: { id: questionScore.questionId },
          data: {
            technicalScore: questionScore.technicalScore,
            starSituationScore: questionScore.situationScore,
            starTaskScore: questionScore.taskScore,
            starActionScore: questionScore.actionScore,
            starResultScore: questionScore.resultScore,
            keyTakeawaysJson: jsonValue(questionScore.keyTakeaways),
          },
        });
      }
    }
    if (input.applicationId) {
      const application = await tx.application.findUnique({
        where: { id: input.applicationId },
        select: { status: true },
      });
      const next = application
        ? pipelineAfterSessionComplete(parsePipelineStatus(application.status))
        : null;
      if (next) {
        await tx.application.updateMany({
          where: {
            id: input.applicationId,
            status: { in: ["SUBMITTED", "AI_INTERVIEW_PENDING", "AI_INTERVIEW_IN_PROGRESS"] },
          },
          data: { status: next },
        });
      }
    }
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để hoàn tất phỏng vấn AI.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ ứng viên mới có thể hoàn tất phiên phỏng vấn.", 403);
  const completeLimit = await consumeKeyedLimit("complete", user.userId, 20, 10 * 60_000);
  if (!completeLimit.ok) {
    return errorResponse("Quá nhiều lần hoàn tất phỏng vấn. Vui lòng thử lại sau.", 429);
  }

  const parsed = CompleteInterviewSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Thời lượng phiên không hợp lệ.", 400);
  const { id } = await context.params;

  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.userId },
      select: {
        id: true,
        userId: true,
        applicationId: true,
        targetRole: true,
        difficulty: true,
        status: true,
        startedAt: true,
        durationSeconds: true,
        contextJson: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, prompt: true, category: true },
        },
        transcripts: {
          orderBy: [{ sequenceNumber: "asc" }, { timestamp: "asc" }, { startElapsedMs: "asc" }],
          select: {
            questionId: true,
            speaker: true,
            text: true,
            sequenceNumber: true,
            turnId: true,
            parentTurnId: true,
            timestamp: true,
          },
        },
        job: { select: { title: true, descriptionRaw: true, rubricJson: true } },
        application: { select: { id: true, resume: { select: { parsedText: true } } } },
        interviewScore: { select: { evaluationStatus: true } },
      },
    });
    if (!session) return errorResponse("Phiên phỏng vấn AI không tồn tại.", 404);
    if (session.status === "COMPLETED" && session.interviewScore?.evaluationStatus === "READY") {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        evaluationStatus: "READY",
      });
    }

    const endedAt = new Date();
    const durationSeconds =
      parsed.data.durationSeconds ??
      session.durationSeconds ??
      (session.startedAt
        ? Math.max(0, Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000))
        : 0);
    const sessionContext = parseSessionContext(session.contextJson);
    const resumeText = resumeTextFromSession({
      applicationResumeText: session.application?.resume?.parsedText,
      contextJson: session.contextJson,
    });
    const evalInput = {
      jobTitle: session.job?.title ?? session.targetRole,
      jobDescription: session.job?.descriptionRaw ?? sessionContext.job?.description ?? "",
      resumeText,
      rubric: Array.isArray(session.job?.rubricJson)
        ? (session.job?.rubricJson as Array<{
            label: string;
            weight: number;
            description?: string;
          }>)
        : [],
      questions: session.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        category: question.category,
      })),
      transcripts: session.transcripts.map((transcript) => ({
        questionId: transcript.questionId,
        speaker: transcript.speaker,
        text: transcript.text,
      })),
    };
    const blueprint = analyzeInterviewBlueprint({
      targetRole: session.job?.title ?? session.targetRole,
      jobDescription: session.job?.descriptionRaw ?? sessionContext.job?.description ?? "",
      resumeText,
      rubric: evalInput.rubric,
      difficulty: session.difficulty,
    });
    const contextRecord =
      session.contextJson &&
      typeof session.contextJson === "object" &&
      !Array.isArray(session.contextJson)
        ? (session.contextJson as Record<string, unknown>)
        : {};
    const persistedState =
      contextRecord.adaptiveState &&
      typeof contextRecord.adaptiveState === "object" &&
      !Array.isArray(contextRecord.adaptiveState) &&
      (contextRecord.adaptiveState as { schemaVersion?: unknown }).schemaVersion === 1
        ? (contextRecord.adaptiveState as InterviewState)
        : createInitialInterviewState(blueprint, {
            remainingTimeMs: Math.max(0, durationSeconds * 1000),
          });
    const adaptiveTranscript: InterviewTranscriptTurn[] = session.transcripts.map(
      (transcript, index) => ({
        turnId: transcript.turnId ?? `legacy:${transcript.questionId ?? "unknown"}:${index + 1}`,
        questionId: transcript.questionId,
        parentTurnId: transcript.parentTurnId,
        speaker: transcript.speaker === "candidate" ? "candidate" : "interviewer",
        timestamp: transcript.timestamp.toISOString(),
        sequenceNumber: transcript.sequenceNumber ?? index + 1,
        text: transcript.text,
      }),
    );
    const adaptiveReport = buildAdaptiveEvidenceReport({
      blueprint,
      state: persistedState,
      transcript: adaptiveTranscript,
    });
    const fallbackEvaluation = evaluateInterview(evalInput);

    await prisma.interviewSession.update({
      where: { id },
      data: {
        status: "COMPLETED",
        endedAt,
        durationSeconds,
        processingStartedAt: null,
        failureReason: null,
      },
      select: { id: true },
    });
    await persistEvaluation({
      sessionId: id,
      applicationId: session.applicationId,
      evaluation: fallbackEvaluation,
      provider: "free-heuristic-v1",
      narrativeStatus: "heuristic",
      questionEvalStatus: "heuristic",
      rubricJson: session.job?.rubricJson,
      adaptiveReportJson: adaptiveReport,
    });

    after(() => {
      void writeAuditLog(user, "interview.completed", id, {
        overallScore: fallbackEvaluation.overallScore,
        applicationId: session.applicationId,
        provider: "free-heuristic-v1",
      });
      void notifyInterviewCompleted({
        sessionId: id,
        applicationId: session.applicationId,
        candidateUserId: session.userId,
        jobTitle: session.job?.title ?? session.targetRole,
      });
      void evaluateWithGemini({ ...evalInput, fallback: fallbackEvaluation })
        .then(async (evaluated) => {
          if (evaluated.provider === "free-heuristic-v1") return;
          await persistEvaluation({
            sessionId: id,
            applicationId: session.applicationId,
            evaluation: evaluated.evaluation,
            provider: evaluated.provider,
            narrativeStatus: evaluated.narrativeStatus,
            questionEvalStatus: evaluated.questionEvalStatus,
            rubricJson: session.job?.rubricJson,
            adaptiveReportJson: adaptiveReport,
          });
          await writeAuditLog(user, "interview.reevaluated", id, {
            provider: evaluated.provider,
            overallScore: evaluated.evaluation.overallScore,
          });
        })
        .catch((error) => {
          console.warn(
            "[Interview Complete] Gemini nền",
            error instanceof Error ? error.message : error,
          );
        });
    });

    return NextResponse.json({
      success: true,
      session: {
        id,
        applicationId: session.applicationId,
        status: "COMPLETED",
        endedAt,
        durationSeconds,
      },
      evaluationStatus: "READY",
      provider: "free-heuristic-v1",
    });
  } catch (error: unknown) {
    console.error("[Interview Complete POST]", error instanceof Error ? error.message : error);
    await prisma.interviewSession
      .updateMany({
        where: { id, userId: user.userId },
        data: { status: "FAILED", failureReason: "Evaluation failed" },
      })
      .catch(() => null);
    return errorResponse("Không thể hoàn tất và chấm điểm phỏng vấn AI.", 503);
  }
}
