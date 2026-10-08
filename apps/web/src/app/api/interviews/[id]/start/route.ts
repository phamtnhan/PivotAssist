import { after, NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";
import type { InterviewState } from "@pivotassist/contracts";

function readAdaptiveState(value: unknown): InterviewState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { adaptiveState?: unknown }).adaptiveState;
  if (!candidate || typeof candidate !== "object") return null;
  const state = candidate as Partial<InterviewState>;
  if (state.schemaVersion !== 1 || typeof state.currentQuestionId !== "string") return null;
  return state as InterviewState;
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để bắt đầu phiên phỏng vấn.", 401);
  const { id } = await context.params;
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.userId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        contextJson: true,
      },
    });
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    if (["COMPLETED", "PROCESSING"].includes(session.status))
      return errorResponse("Phiên phỏng vấn đã kết thúc hoặc đang được chấm.", 409);
    await prisma.$transaction(async (tx) => {
      await tx.interviewSession.update({
        where: { id },
        data: { status: "IN_PROGRESS", startedAt: session.startedAt ?? new Date() },
        select: { id: true },
      });
      const state = readAdaptiveState(session.contextJson);
      if (!state?.currentQuestionId || !state.currentAssistantTurnId) return;
      const question = await tx.interviewQuestion.findUnique({
        where: { id: state.currentQuestionId },
        select: { id: true, prompt: true },
      });
      if (!question) return;
      const existing = await tx.transcriptSegment.findFirst({
        where: { sessionId: id, turnId: state.currentAssistantTurnId, speaker: "interviewer" },
        select: { id: true },
      });
      if (existing) return;
      await tx.transcriptSegment.create({
        data: {
          sessionId: id,
          questionId: question.id,
          turnId: state.currentAssistantTurnId,
          parentTurnId: null,
          speaker: "interviewer",
          text: question.prompt,
          startElapsedMs: 0,
          endElapsedMs: 0,
          sequenceNumber: 1,
          mode: state.mode,
        },
      });
    });
    after(() => {
      void writeAuditLog(user, "interview.started", id);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Interview Start POST]", error);
    return errorResponse("Không thể bắt đầu phiên phỏng vấn.", 503);
  }
}
