import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { sanitizeInterviewPrompt } from "@/lib/interview-copy";
import { errorResponse } from "@/lib/server-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem câu hỏi phỏng vấn.", 401);
  const { id } = await context.params;
  try {
    const [session, questions] = await Promise.all([
      prisma.interviewSession.findFirst({
        where: { id, userId: user.userId },
        select: { id: true, targetRole: true, status: true, contextJson: true },
      }),
      prisma.interviewQuestion.findMany({
        where: { sessionId: id },
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true, category: true, prompt: true },
      }),
    ]);
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    const language = new URL(_request.url).searchParams.get("lang") === "en" ? "en" : "vi";
    const context =
      session.contextJson &&
      typeof session.contextJson === "object" &&
      !Array.isArray(session.contextJson)
        ? (session.contextJson as {
            adaptiveState?: {
              schemaVersion?: unknown;
              currentQuestionId?: unknown;
              currentAssistantTurnId?: unknown;
              turnNumber?: unknown;
              mode?: unknown;
            };
          })
        : {};
    const state = context.adaptiveState;
    const currentQuestionId =
      typeof state?.currentQuestionId === "string" ? state.currentQuestionId : null;
    const adaptiveStateClosed =
      state?.schemaVersion === 1 &&
      currentQuestionId === null &&
      typeof state.turnNumber === "number" &&
      state.turnNumber > 0;
    const currentQuestion = adaptiveStateClosed
      ? null
      : (questions.find((question) => question.id === currentQuestionId) ?? questions[0] ?? null);
    const turnNumber = typeof state?.turnNumber === "number" ? state.turnNumber : 0;
    const currentTtsKey =
      typeof state?.currentAssistantTurnId === "string"
        ? `${id}:${state.currentAssistantTurnId}`
        : null;
    return NextResponse.json({
      success: true,
      targetRole: session.targetRole,
      sessionStatus: session.status,
      language,
      turnNumber,
      currentTtsKey,
      currentQuestion: currentQuestion
        ? {
            id: currentQuestion.id,
            order: currentQuestion.orderIndex,
            category: currentQuestion.category,
            prompt: sanitizeInterviewPrompt(currentQuestion.prompt, language),
          }
        : null,
      questions: questions.map((question) => ({
        id: question.id,
        order: question.orderIndex,
        category: question.category,
        prompt: sanitizeInterviewPrompt(question.prompt, language),
      })),
    });
  } catch (error) {
    console.error("[Interview Questions GET]", error);
    return errorResponse("Không thể tải câu hỏi phỏng vấn.", 503);
  }
}
