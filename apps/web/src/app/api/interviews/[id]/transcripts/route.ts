import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

const SegmentSchema = z.object({
  questionId: z.string().min(1).nullable().optional(),
  speaker: z.enum(["interviewer", "candidate"]),
  text: z.string().trim().min(1).max(20000),
  startElapsedMs: z.number().int().min(0),
  endElapsedMs: z.number().int().min(0),
  confidence: z.number().min(0).max(1).optional(),
  turnId: z.string().min(1).max(100).optional(),
  parentTurnId: z.string().min(1).max(100).nullable().optional(),
  sequenceNumber: z.number().int().min(1).optional(),
  mode: z.enum(["ADAPTIVE", "FALLBACK"]).optional(),
});
const BodySchema = z.union([
  SegmentSchema,
  z.object({ segments: z.array(SegmentSchema).min(1).max(100) }),
]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem transcript.", 401);
  const { id } = await context.params;
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.userId },
      select: { id: true },
    });
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    const segments = await prisma.transcriptSegment.findMany({
      where: { sessionId: id },
      orderBy: [{ sequenceNumber: "asc" }, { timestamp: "asc" }, { startElapsedMs: "asc" }],
    });
    return NextResponse.json({ success: true, segments });
  } catch (error) {
    console.error("[Transcripts GET]", error);
    return errorResponse("Không thể tải transcript.", 503);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để ghi transcript.", 401);
  const { id } = await context.params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Transcript không hợp lệ.", 400);
  const segments = "segments" in parsed.data ? parsed.data.segments : [parsed.data];
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.userId },
      select: { id: true, status: true },
    });
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    if (["COMPLETED", "FAILED"].includes(session.status))
      return errorResponse("Không thể ghi transcript sau khi phiên đã kết thúc.", 409);
    const questionIds = [
      ...new Set(segments.flatMap((segment) => (segment.questionId ? [segment.questionId] : []))),
    ];
    if (questionIds.length > 0) {
      const questions = await prisma.interviewQuestion.findMany({
        where: { id: { in: questionIds }, sessionId: id },
        select: { id: true },
      });
      if (questions.length !== questionIds.length)
        return errorResponse("Transcript tham chiếu câu hỏi không thuộc phiên này.", 400);
    }
    const byTurn = new Map<string, (typeof segments)[number]>();
    const uniqueSegments = segments.filter((segment) => {
      if (!segment.turnId) return true;
      const key = `${segment.turnId}:${segment.speaker}`;
      const previous = byTurn.get(key);
      if (!previous) {
        byTurn.set(key, segment);
        return true;
      }
      const matches =
        (previous.questionId ?? null) === (segment.questionId ?? null) &&
        (previous.parentTurnId ?? null) === (segment.parentTurnId ?? null) &&
        (previous.sequenceNumber ?? null) === (segment.sequenceNumber ?? null) &&
        (previous.mode ?? "ADAPTIVE") === (segment.mode ?? "ADAPTIVE") &&
        previous.text === segment.text &&
        previous.startElapsedMs === segment.startElapsedMs &&
        Math.max(previous.startElapsedMs, previous.endElapsedMs) ===
          Math.max(segment.startElapsedMs, segment.endElapsedMs) &&
        (previous.confidence ?? 0.95) === (segment.confidence ?? 0.95);
      if (!matches) throw new Error("TRANSCRIPT_TURN_CONFLICT");
      return false;
    });
    const turnIds = [
      ...new Set(uniqueSegments.flatMap((segment) => (segment.turnId ? [segment.turnId] : []))),
    ];
    const existing =
      turnIds.length === 0
        ? []
        : await prisma.transcriptSegment.findMany({
            where: { sessionId: id, turnId: { in: turnIds } },
            select: {
              turnId: true,
              speaker: true,
              questionId: true,
              parentTurnId: true,
              sequenceNumber: true,
              mode: true,
              text: true,
              startElapsedMs: true,
              endElapsedMs: true,
              confidence: true,
            },
          });
    const existingByTurn = new Map(
      existing
        .filter((segment) => segment.turnId)
        .map((segment) => [`${segment.turnId}:${segment.speaker}`, segment]),
    );
    const pending = [] as typeof segments;
    for (const segment of uniqueSegments) {
      const previous = segment.turnId
        ? existingByTurn.get(`${segment.turnId}:${segment.speaker}`)
        : undefined;
      if (!previous) {
        pending.push(segment);
        continue;
      }
      const matches =
        (previous.questionId ?? null) === (segment.questionId ?? null) &&
        (previous.parentTurnId ?? null) === (segment.parentTurnId ?? null) &&
        (previous.sequenceNumber ?? null) === (segment.sequenceNumber ?? null) &&
        previous.mode === (segment.mode ?? "ADAPTIVE") &&
        previous.text === segment.text &&
        previous.startElapsedMs === segment.startElapsedMs &&
        previous.endElapsedMs === Math.max(segment.startElapsedMs, segment.endElapsedMs) &&
        previous.confidence === (segment.confidence ?? 0.95);
      if (!matches)
        return errorResponse(
          "Transcript turn đã tồn tại với payload khác.",
          409,
          "TRANSCRIPT_TURN_CONFLICT",
        );
    }
    if (pending.length === 0)
      return NextResponse.json(
        { success: true, inserted: 0, replayed: segments.length },
        { status: 200 },
      );
    const created = await prisma.transcriptSegment.createMany({
      data: pending.map((segment) => ({
        sessionId: id,
        questionId: segment.questionId ?? null,
        turnId: segment.turnId ?? null,
        parentTurnId: segment.parentTurnId ?? null,
        sequenceNumber: segment.sequenceNumber ?? null,
        mode: segment.mode ?? "ADAPTIVE",
        speaker: segment.speaker,
        text: segment.text,
        startElapsedMs: segment.startElapsedMs,
        endElapsedMs: Math.max(segment.startElapsedMs, segment.endElapsedMs),
        confidence: segment.confidence ?? 0.95,
      })),
    });
    return NextResponse.json(
      { success: true, inserted: created.count, replayed: segments.length - pending.length },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "TRANSCRIPT_TURN_CONFLICT")
      return errorResponse(
        "Transcript turn đã tồn tại với payload khác.",
        409,
        "TRANSCRIPT_TURN_CONFLICT",
      );
    console.error("[Transcripts POST]", error);
    return errorResponse("Không thể lưu transcript.", 503);
  }
}
