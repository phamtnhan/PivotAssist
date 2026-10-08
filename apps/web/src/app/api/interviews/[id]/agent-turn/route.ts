import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@pivotassist/db";
import { generateAdaptiveLiveTurn, type AdaptiveLiveTurnResult } from "@/lib/adaptive-interviewer";
import { getCurrentUser, prisma } from "@/lib/auth";
import { sanitizeInterviewPrompt } from "@/lib/interview-copy";
import { parseSessionContext, resumeTextFromSession } from "@/lib/interview-context";
import { consumeKeyedLimit } from "@/lib/keyed-limit";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse } from "@/lib/server-utils";
import type {
  InterviewBlueprint,
  InterviewState,
  InterviewTranscriptTurn,
} from "@pivotassist/contracts";
import { analyzeInterviewBlueprint, createInitialInterviewState } from "@pivotassist/contracts";

const Schema = z
  .object({
    candidateSpeechText: z.string().trim().min(1).max(20000),
    questionId: z.string().min(1),
    elapsedMs: z.number().int().min(0),
    turnId: z.string().trim().min(1).max(100),
  })
  .strict();

const StoredTurnResponseSchema = z.object({
  success: z.literal(true),
  turnId: z.string(),
  assistantTurnId: z.string(),
  ttsKey: z.string(),
  replyAudioText: z.string(),
  nextQuestion: z
    .object({
      id: z.string(),
      order: z.number(),
      category: z.string().optional(),
      prompt: z.string(),
    })
    .nullable(),
  isLastQuestion: z.boolean(),
  provider: z.string(),
  mode: z.enum(["ADAPTIVE", "FALLBACK"]),
});

type TurnResponsePayload = z.infer<typeof StoredTurnResponseSchema>;

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readState(
  value: unknown,
  blueprint: InterviewBlueprint,
  questionId: string,
): InterviewState {
  const candidate = asRecord(value).adaptiveState;
  if (
    candidate &&
    typeof candidate === "object" &&
    (candidate as { schemaVersion?: unknown }).schemaVersion === 1
  ) {
    const state = candidate as InterviewState;
    if (state.currentQuestionId === questionId) return state;
    if (state.currentQuestionId === null && state.turnNumber === 0) {
      return {
        ...state,
        currentQuestionId: questionId,
        currentAssistantTurnId: `question:${questionId}`,
      };
    }
    // A stale client cannot skip the durable current question.
    throw new Error("STALE_INTERVIEW_QUESTION");
  }
  const state = createInitialInterviewState(blueprint);
  return {
    ...state,
    currentQuestionId: questionId,
    currentAssistantTurnId: `question:${questionId}`,
  };
}

function readStoredResponse(value: unknown): TurnResponsePayload | null {
  const parsed = StoredTurnResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function toTranscriptTurn(
  row: {
    turnId: string | null;
    questionId: string | null;
    parentTurnId: string | null;
    speaker: string;
    timestamp: Date;
    sequenceNumber: number | null;
    text: string;
  },
  fallbackSequence: number,
): InterviewTranscriptTurn {
  return {
    turnId: row.turnId ?? `legacy:${row.questionId ?? "unknown"}:${fallbackSequence}`,
    questionId: row.questionId,
    parentTurnId: row.parentTurnId,
    speaker: row.speaker === "candidate" ? "candidate" : "interviewer",
    timestamp: row.timestamp.toISOString(),
    sequenceNumber: row.sequenceNumber ?? fallbackSequence,
    text: row.text,
  };
}

function buildStateAfterQuestion(
  result: AdaptiveLiveTurnResult,
  input: {
    state: InterviewState;
    currentQuestionId: string;
    candidateTurnId: string;
    nextQuestionId: string | null;
    elapsedMs: number;
    remainingTimeMs: number;
    recentTurns: InterviewTranscriptTurn[];
  },
): InterviewState {
  const nextQuestion = result.nextQuestion;
  const askedQuestions =
    nextQuestion && input.nextQuestionId
      ? [
          ...input.state.askedQuestions,
          {
            questionId: input.nextQuestionId,
            turnId: input.candidateTurnId,
            prompt: nextQuestion.prompt,
            competency: nextQuestion.competency,
            action: result.directive.action,
          },
        ]
      : input.state.askedQuestions;
  return {
    ...result.state,
    currentQuestionId: input.nextQuestionId,
    currentAssistantTurnId: nextQuestion ? input.candidateTurnId : null,
    askedQuestions,
    elapsedTimeMs: input.elapsedMs,
    remainingTimeMs: input.remainingTimeMs,
    recentTurns: input.recentTurns,
    mode: result.mode,
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;

  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để tương tác với phỏng vấn AI.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Nội dung câu trả lời hoặc mã turn không hợp lệ.", 400);
  const { id } = await context.params;
  const requestTurnId = parsed.data.turnId;
  const ttsKey = `${id}:${requestTurnId}`;

  // The replay fast-path is still an authenticated read. Check ownership
  // before looking up a durable response so a guessed session id cannot leak
  // a previously committed answer/question payload across candidates.
  const ownedSession = await prisma.interviewSession.findFirst({
    where: { id, userId: user.userId },
    select: { id: true },
  });
  if (!ownedSession) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);

  // Durable replay is checked before rate accounting. A browser retry of an
  // already committed turn is a read, not a second interview turn.
  const stored = await prisma.interviewTurnResult
    .findUnique({
      where: { sessionId_turnId: { sessionId: id, turnId: requestTurnId } },
      select: { responseJson: true },
    })
    .catch(() => null);
  const storedPayload = stored ? readStoredResponse(stored.responseJson) : null;
  if (storedPayload) return NextResponse.json(storedPayload);

  const turnLimit = await consumeKeyedLimit("agent-turn", user.userId, 60, 10 * 60_000);
  if (!turnLimit.ok) return errorResponse("Quá nhiều lượt trả lời. Vui lòng thử lại sau.", 429);

  const lang =
    request.nextUrl.searchParams.get("lang") === "en" ? ("en" as const) : ("vi" as const);

  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.userId },
      select: {
        id: true,
        status: true,
        targetRole: true,
        difficulty: true,
        contextJson: true,
        job: { select: { title: true, descriptionRaw: true, rubricJson: true } },
        application: { select: { resume: { select: { parsedText: true } } } },
        questions: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, orderIndex: true, prompt: true, category: true },
        },
      },
    });
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    if (["COMPLETED", "FAILED"].includes(session.status))
      return errorResponse("Phiên phỏng vấn đã kết thúc.", 409);

    const sessionContext = parseSessionContext(session.contextJson);
    const jobTitle = session.job?.title ?? sessionContext.job?.title ?? session.targetRole;
    const jobDescription = session.job?.descriptionRaw ?? sessionContext.job?.description ?? "";
    const resumeText = resumeTextFromSession({
      applicationResumeText: session.application?.resume?.parsedText,
      contextJson: session.contextJson,
    });
    const employerRubric = Array.isArray(session.job?.rubricJson)
      ? session.job.rubricJson.filter(
          (item): item is { label: string; weight?: number; description?: string } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { label?: unknown }).label === "string",
        )
      : Array.isArray((sessionContext as { rubric?: unknown }).rubric)
        ? ((sessionContext as { rubric?: unknown[] }).rubric ?? []).filter(
            (item): item is { label: string; weight?: number; description?: string } =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as { label?: unknown }).label === "string",
          )
        : [];

    const blueprint = analyzeInterviewBlueprint({
      targetRole: jobTitle,
      jobDescription,
      resumeText,
      rubric: employerRubric,
      difficulty: session.difficulty,
    });
    const state = readState(session.contextJson, blueprint, parsed.data.questionId);
    const currentQuestion = session.questions.find(
      (question) => question.id === parsed.data.questionId,
    );
    if (!currentQuestion) return errorResponse("Mã câu hỏi không thuộc phiên phỏng vấn này.", 400);

    const recentRows = await prisma.transcriptSegment.findMany({
      where: { sessionId: id },
      orderBy: [{ sequenceNumber: "desc" }, { timestamp: "desc" }],
      take: 16,
      select: {
        turnId: true,
        questionId: true,
        parentTurnId: true,
        speaker: true,
        timestamp: true,
        sequenceNumber: true,
        text: true,
      },
    });
    const recentTranscript = recentRows
      .reverse()
      .map((row, index) => toTranscriptTurn(row, index + 1));
    const remainingTimeMs = Math.max(
      0,
      state.remainingTimeMs - Math.max(0, parsed.data.elapsedMs - state.elapsedTimeMs),
    );
    let result = await generateAdaptiveLiveTurn({
      jobTitle,
      jobDescription,
      resumeText,
      rubric: employerRubric,
      difficulty: session.difficulty,
      state,
      currentQuestion: {
        id: currentQuestion.id,
        prompt: currentQuestion.prompt,
        category: currentQuestion.category,
        competency: state.currentCompetency,
        assistantTurnId: state.currentAssistantTurnId,
      },
      candidateSpeechText: parsed.data.candidateSpeechText,
      recentTranscript,
      elapsedTimeMs: parsed.data.elapsedMs,
      remainingTimeMs,
      language: lang,
      turnId: requestTurnId,
      fallbackQuestions: session.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        category: question.category,
      })),
    });

    let demoNextQuestionId: string | null = null;
    const demoFixedQuestions = Array.isArray(asRecord(session.contextJson).demoFixedQuestions)
      ? (asRecord(session.contextJson).demoFixedQuestions as unknown[]).filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [];
    if (demoFixedQuestions.length > 0) {
      const nextIndex = currentQuestion.orderIndex;
      const nextPrompt = demoFixedQuestions[nextIndex] ?? null;
      const nextRow = session.questions.find((question) => question.orderIndex === nextIndex + 1);
      demoNextQuestionId = nextRow?.id ?? null;
      result = {
        ...result,
        nextQuestion:
          nextPrompt && nextRow
            ? {
                ...(result.nextQuestion ?? {
                  questionId: nextRow.id,
                  category: nextRow.category ?? "behavioral",
                  competency: state.currentCompetency ?? "role_competency",
                  prompt: nextPrompt,
                }),
                prompt: nextPrompt,
              }
            : null,
        mode: "FALLBACK",
        provider: "demo-fixed-v1",
      };
    }

    const committed = await prisma.$transaction(async (tx) => {
      const replay = await tx.interviewTurnResult.findUnique({
        where: { sessionId_turnId: { sessionId: id, turnId: requestTurnId } },
        select: { responseJson: true },
      });
      const replayPayload = replay ? readStoredResponse(replay.responseJson) : null;
      if (replayPayload) return replayPayload;

      const liveSession = await tx.interviewSession.findUnique({
        where: { id },
        select: { contextJson: true },
      });
      const liveCandidate = asRecord(liveSession?.contextJson).adaptiveState;
      if (
        liveCandidate &&
        typeof liveCandidate === "object" &&
        (liveCandidate as { schemaVersion?: unknown }).schemaVersion === 1
      ) {
        const liveState = liveCandidate as InterviewState;
        if (
          liveState.currentQuestionId !== currentQuestion.id &&
          !(liveState.currentQuestionId === null && liveState.turnNumber === 0)
        ) {
          throw new Error("STALE_INTERVIEW_QUESTION");
        }
      }

      const latest = await tx.transcriptSegment.findFirst({
        where: { sessionId: id },
        orderBy: [{ sequenceNumber: "desc" }, { timestamp: "desc" }],
        select: { sequenceNumber: true },
      });
      const candidateSequence = (latest?.sequenceNumber ?? 0) + 1;
      const nextQuestion = result.nextQuestion;
      const occurredAt = new Date();
      let nextQuestionRow: { id: string; orderIndex: number } | null = null;
      if (nextQuestion) {
        const maxOrder = session.questions.reduce(
          (max, question) => Math.max(max, question.orderIndex),
          0,
        );
        const existingNext = demoNextQuestionId
          ? session.questions.find((question) => question.id === demoNextQuestionId)
          : null;
        nextQuestionRow = existingNext
          ? { id: existingNext.id, orderIndex: existingNext.orderIndex }
          : await tx.interviewQuestion.create({
              data: {
                sessionId: id,
                orderIndex: maxOrder + 1,
                category: nextQuestion.category,
                prompt: sanitizeInterviewPrompt(nextQuestion.prompt, lang),
                keyTakeawaysJson: [nextQuestion.competency],
              },
              select: { id: true, orderIndex: true },
            });
      }

      await tx.interviewQuestion.update({
        where: { id: currentQuestion.id },
        data: { answeredElapsedMs: parsed.data.elapsedMs },
      });
      await tx.transcriptSegment.create({
        data: {
          sessionId: id,
          questionId: currentQuestion.id,
          turnId: requestTurnId,
          parentTurnId: state.currentAssistantTurnId,
          speaker: "candidate",
          text: parsed.data.candidateSpeechText,
          startElapsedMs: parsed.data.elapsedMs,
          endElapsedMs: parsed.data.elapsedMs + 1000,
          sequenceNumber: candidateSequence,
          timestamp: occurredAt,
          mode: result.mode,
        },
      });
      if (nextQuestion && nextQuestionRow) {
        await tx.transcriptSegment.create({
          data: {
            sessionId: id,
            questionId: nextQuestionRow.id,
            turnId: requestTurnId,
            parentTurnId: requestTurnId,
            speaker: "interviewer",
            text: sanitizeInterviewPrompt(nextQuestion.prompt, lang),
            startElapsedMs: parsed.data.elapsedMs + 1000,
            endElapsedMs: parsed.data.elapsedMs + 2500,
            sequenceNumber: candidateSequence + 1,
            timestamp: occurredAt,
            mode: result.mode,
          },
        });
      }

      const committedTurns: InterviewTranscriptTurn[] = [
        {
          turnId: requestTurnId,
          questionId: currentQuestion.id,
          parentTurnId: state.currentAssistantTurnId,
          speaker: "candidate",
          timestamp: occurredAt.toISOString(),
          sequenceNumber: candidateSequence,
          text: parsed.data.candidateSpeechText,
        },
        ...(nextQuestion && nextQuestionRow
          ? [
              {
                turnId: requestTurnId,
                questionId: nextQuestionRow.id,
                parentTurnId: requestTurnId,
                speaker: "interviewer" as const,
                timestamp: occurredAt.toISOString(),
                sequenceNumber: candidateSequence + 1,
                text: sanitizeInterviewPrompt(nextQuestion.prompt, lang),
              },
            ]
          : []),
      ];

      const nextState = buildStateAfterQuestion(result, {
        state,
        currentQuestionId: currentQuestion.id,
        candidateTurnId: requestTurnId,
        nextQuestionId: nextQuestionRow?.id ?? null,
        elapsedMs: parsed.data.elapsedMs,
        remainingTimeMs,
        recentTurns: [...result.state.recentTurns, ...committedTurns].slice(-8),
      });
      const context = asRecord(session.contextJson);
      await tx.interviewSession.update({
        where: { id },
        data: { contextJson: asJsonValue({ ...context, adaptiveState: nextState }) },
      });

      const payload: TurnResponsePayload = {
        success: true,
        turnId: requestTurnId,
        assistantTurnId: nextQuestion ? requestTurnId : "",
        ttsKey,
        replyAudioText: result.replyAudioText,
        nextQuestion:
          nextQuestion && nextQuestionRow
            ? {
                id: nextQuestionRow.id,
                order: nextQuestionRow.orderIndex,
                category: nextQuestion.category,
                prompt: sanitizeInterviewPrompt(nextQuestion.prompt, lang),
              }
            : null,
        isLastQuestion: !nextQuestion,
        provider: result.provider,
        mode: result.mode,
      };
      await tx.interviewTurnResult.create({
        data: {
          sessionId: id,
          turnId: requestTurnId,
          ttsKey,
          mode: result.mode,
          responseJson: asJsonValue(payload),
        },
      });
      return payload;
    });
    return NextResponse.json(committed);
  } catch (error) {
    if (error instanceof Error && error.message === "STALE_INTERVIEW_QUESTION") {
      return errorResponse("Lượt phỏng vấn đã thay đổi; hãy dùng câu hỏi hiện tại.", 409);
    }
    if (isUniqueConstraint(error)) {
      const replay = await prisma.interviewTurnResult
        .findUnique({
          where: { sessionId_turnId: { sessionId: id, turnId: requestTurnId } },
          select: { responseJson: true },
        })
        .catch(() => null);
      const payload = replay ? readStoredResponse(replay.responseJson) : null;
      if (payload) return NextResponse.json(payload);
    }
    console.error("[Interview Agent Turn]", error instanceof Error ? error.message : error);
    return errorResponse("Không thể xử lý lượt trả lời phỏng vấn thích ứng.", 503);
  }
}
