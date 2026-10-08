import { prisma, type Prisma } from "@pivotassist/db";
import type { InterviewState } from "@pivotassist/contracts";
import type { InterviewStateStore } from "./prompt-coordinator.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function readState(value: unknown): InterviewState | null {
  const candidate = asRecord(value).adaptiveState;
  if (!candidate || typeof candidate !== "object") return null;
  const state = candidate as InterviewState;
  return state.schemaVersion === 1 ? state : null;
}

/** Durable state adapter used by a real LiveKit worker instead of process memory. */
export class PrismaInterviewStateStore implements InterviewStateStore {
  async load(sessionId: string): Promise<InterviewState | null> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { contextJson: true },
    });
    return readState(session?.contextJson);
  }

  async save(sessionId: string, state: InterviewState): Promise<void> {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { contextJson: true },
    });
    const context = asRecord(session?.contextJson);
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { contextJson: asJsonValue({ ...context, adaptiveState: state }) },
    });
  }
}

export interface DurableTurnStore<T> {
  load(sessionId: string, turnId: string): Promise<T | null>;
  save(
    sessionId: string,
    turnId: string,
    ttsKey: string,
    mode: "ADAPTIVE" | "FALLBACK",
    value: T,
  ): Promise<T>;
}

/** Durable replay store. A unique constraint makes concurrent retries converge. */
export class PrismaInterviewTurnStore<T> implements DurableTurnStore<T> {
  async load(sessionId: string, turnId: string): Promise<T | null> {
    const row = await prisma.interviewTurnResult.findUnique({
      where: { sessionId_turnId: { sessionId, turnId } },
      select: { responseJson: true },
    });
    return (row?.responseJson ?? null) as T | null;
  }

  async save(
    sessionId: string,
    turnId: string,
    ttsKey: string,
    mode: "ADAPTIVE" | "FALLBACK",
    value: T,
  ): Promise<T> {
    try {
      await prisma.interviewTurnResult.create({
        data: { sessionId, turnId, ttsKey, mode, responseJson: asJsonValue(value) },
      });
      return value;
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      return (await this.load(sessionId, turnId)) ?? value;
    }
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
