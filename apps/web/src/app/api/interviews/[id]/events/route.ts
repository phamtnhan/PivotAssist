import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

const EventSchema = z.object({
  questionId: z.string().min(1).nullable().optional(),
  seq: z.number().int().min(0),
  elapsedMs: z.number().int().min(0),
  durationMs: z.number().int().min(0).nullable().optional(),
  type: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1000),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
});
const BodySchema = z.union([
  EventSchema,
  z.object({ events: z.array(EventSchema).min(1).max(200) }),
]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem visual event.", 401);
  const { id } = await context.params;
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.userId },
      select: { id: true },
    });
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    const events = await prisma.visualEventLog.findMany({
      where: { sessionId: id },
      orderBy: { seq: "asc" },
    });
    return NextResponse.json({ success: true, events });
  } catch (error) {
    console.error("[Interview Events GET]", error);
    return errorResponse("Không thể tải visual event.", 503);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để ghi visual event.", 401);
  const { id } = await context.params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Visual event không hợp lệ.", 400);
  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];
  try {
    const session = await prisma.interviewSession.findFirst({
      where: { id, userId: user.userId },
      select: { id: true, status: true },
    });
    if (!session) return errorResponse("Phiên phỏng vấn không tồn tại.", 404);
    if (["COMPLETED", "FAILED"].includes(session.status))
      return errorResponse("Không thể ghi visual event sau khi phiên đã kết thúc.", 409);
    const questionIds = [
      ...new Set(events.flatMap((event) => (event.questionId ? [event.questionId] : []))),
    ];
    if (questionIds.length > 0) {
      const questions = await prisma.interviewQuestion.findMany({
        where: { id: { in: questionIds }, sessionId: id },
        select: { id: true },
      });
      if (questions.length !== questionIds.length)
        return errorResponse("Visual event tham chiếu câu hỏi không thuộc phiên này.", 400);
    }
    const bySequence = new Map<number, (typeof events)[number]>();
    for (const event of events) {
      const previous = bySequence.get(event.seq);
      if (previous && JSON.stringify(previous) !== JSON.stringify(event))
        return errorResponse(
          "Một sequence visual event chứa nhiều payload khác nhau.",
          409,
          "VISUAL_EVENT_SEQUENCE_CONFLICT",
        );
      bySequence.set(event.seq, event);
    }
    const uniqueEvents = [...bySequence.values()];
    const existing = await prisma.visualEventLog.findMany({
      where: { sessionId: id, seq: { in: uniqueEvents.map((event) => event.seq) } },
      select: {
        seq: true,
        questionId: true,
        elapsedMs: true,
        durationMs: true,
        type: true,
        label: true,
        description: true,
        severity: true,
      },
    });
    const existingBySequence = new Map(existing.map((event) => [event.seq, event]));
    for (const event of uniqueEvents) {
      const previous = existingBySequence.get(event.seq);
      if (!previous) continue;
      const matches =
        (previous.questionId ?? null) === (event.questionId ?? null) &&
        previous.elapsedMs === event.elapsedMs &&
        (previous.durationMs ?? null) === (event.durationMs ?? null) &&
        previous.type === event.type &&
        previous.label === event.label &&
        previous.description === event.description &&
        previous.severity === event.severity;
      if (!matches)
        return errorResponse(
          "Visual event đã tồn tại với payload khác.",
          409,
          "VISUAL_EVENT_SEQUENCE_CONFLICT",
        );
    }
    const pending = uniqueEvents.filter((event) => !existingBySequence.has(event.seq));
    if (pending.length === 0)
      return NextResponse.json(
        { success: true, inserted: 0, replayed: events.length },
        { status: 200 },
      );
    const created = await prisma.visualEventLog.createMany({
      data: pending.map((event) => ({
        sessionId: id,
        questionId: event.questionId ?? null,
        seq: event.seq,
        elapsedMs: event.elapsedMs,
        durationMs: event.durationMs ?? null,
        type: event.type,
        label: event.label,
        description: event.description,
        severity: event.severity,
      })),
    });
    return NextResponse.json(
      { success: true, inserted: created.count, replayed: events.length - pending.length },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Interview Events POST]", error);
    return errorResponse("Không thể lưu visual event.", 503);
  }
}
