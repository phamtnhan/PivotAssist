import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { prisma } from "@pivotassist/db";
import { InterviewSession, InterviewCoachingReport, VisualEvent } from "@pivotassist/contracts";
import type { NestAuthUser } from "../../auth/jwt-verify.js";

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function contractCategory(
  value: string,
): "behavioral" | "technical" | "system_design" | "domain" | "culture_fit" {
  return ["behavioral", "technical", "system_design", "domain", "culture_fit"].includes(value)
    ? (value as "behavioral" | "technical" | "system_design" | "domain" | "culture_fit")
    : "technical";
}

@Injectable()
export class InterviewsService {
  async createSession(
    params: {
      userId: string;
      targetRole: string;
      difficulty: "junior" | "mid" | "senior";
      jobId?: string;
      applicationId?: string;
    },
    actor?: NestAuthUser,
  ): Promise<InterviewSession> {
    const application = params.applicationId
      ? await prisma.application.findFirst({
          where: { id: params.applicationId, userId: params.userId },
          include: { job: true, resume: { include: { fileAsset: true } } },
        })
      : null;
    if (params.applicationId && !application)
      throw new NotFoundException("Application không tồn tại hoặc không thuộc candidate.");

    let job = application?.job ?? null;
    if (params.jobId && !job) {
      const foundJob = await prisma.job.findUnique({
        where: { id: params.jobId },
        include: { company: { include: { members: { select: { userId: true } } } } },
      });
      if (!foundJob) {
        throw new NotFoundException("Tin tuyển dụng không tồn tại.");
      }
      if (!foundJob.isPublished) {
        const isMember =
          actor?.role === "ADMIN" ||
          foundJob.company.members.some((m) => m.userId === params.userId);
        if (!isMember) {
          throw new ForbiddenException(
            "Không có quyền tạo phiên phỏng vấn cho tin tuyển dụng chưa công bố.",
          );
        }
      }
      job = foundJob;
    }
    const resumeText = application?.resume?.parsedText ?? "";
    const session = await prisma.interviewSession.create({
      data: {
        userId: params.userId,
        jobId: job?.id,
        applicationId: application?.id,
        targetRole: params.targetRole,
        difficulty: params.difficulty,
        status: "CALIBRATING",
        livekitRoomName: `room_${randomUUID().slice(0, 12)}`,
        isVoiceOnly: false,
        startedAt: new Date(),
        contextJson: {
          job: job ? { id: job.id, title: job.title, description: job.descriptionRaw } : null,
          resume: application?.resume
            ? {
                id: application.resume.id,
                filename: application.resume.fileAsset.filename,
                parsedText: resumeText,
              }
            : null,
          provider: "free-heuristic-v1",
        },
      },
    });
    const questions = job
      ? [
          `Hãy giới thiệu kinh nghiệm phù hợp nhất với vị trí ${job.title}.`,
          "Hãy kể một tình huống thực tế theo cấu trúc STAR.",
          "Bạn sẽ xử lý một trade-off kỹ thuật quan trọng như thế nào?",
          "Bạn đo lường kết quả sau khi triển khai giải pháp ra sao?",
        ]
      : [
          `Hãy giới thiệu kinh nghiệm phù hợp với vị trí ${params.targetRole}.`,
          "Hãy kể một tình huống thực tế theo cấu trúc STAR.",
          "Bạn xử lý một vấn đề khó trong công việc như thế nào?",
        ];
    await prisma.interviewQuestion.createMany({
      data: questions.map((prompt, index) => ({
        sessionId: session.id,
        orderIndex: index + 1,
        category: index === 1 ? "behavioral" : index === 2 ? "system_design" : "technical",
        prompt,
      })),
    });
    return {
      id: session.id,
      userId: session.userId,
      jobId: session.jobId ?? undefined,
      applicationId: session.applicationId ?? undefined,
      targetRole: session.targetRole,
      difficulty: session.difficulty as "junior" | "mid" | "senior",
      status: session.status as InterviewSession["status"],
      context: session.contextJson as Record<string, unknown>,
      livekitRoomName: session.livekitRoomName,
      durationSeconds: session.durationSeconds,
      isVoiceOnly: session.isVoiceOnly,
    };
  }

  async recordVisualEvents(
    sessionId: string,
    events: VisualEvent[],
    actor: NestAuthUser,
  ): Promise<void> {
    await this.assertSessionAccess(sessionId, actor);
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException("Phiên interview không tồn tại.");
    if (["COMPLETED", "FAILED"].includes(session.status))
      throw new NotFoundException("Phiên interview đã đóng.");
    if (events.length === 0) return;
    await prisma.visualEventLog.createMany({
      data: events.map((event, index) => ({
        id: event.id ?? randomUUID(),
        sessionId,
        questionId: event.associatedQuestionId,
        seq: event.seq ?? index,
        elapsedMs: event.elapsedMs,
        durationMs: event.durationMs,
        type: event.type,
        label: event.label,
        description: event.description,
        severity: event.severity,
      })),
    });
  }

  async getCoachingReport(
    sessionId: string,
    actor: NestAuthUser,
  ): Promise<InterviewCoachingReport> {
    await this.assertSessionAccess(sessionId, actor);
    await prisma.auditLog
      .create({
        data: { userId: actor.userId, action: "nest.interview.report", resource: sessionId },
      })
      .catch(() => null);
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { fullName: true } },
        job: true,
        questions: { orderBy: { orderIndex: "asc" } },
        transcripts: { orderBy: { startElapsedMs: "asc" } },
        visualEvents: { orderBy: { seq: "asc" } },
        visualSummary: true,
        interviewScore: true,
      },
    });
    if (!session) throw new NotFoundException("Phiên interview không tồn tại.");
    const score = session.interviewScore;
    if (!score) {
      throw new NotFoundException(
        "Chưa có InterviewScore. Hoàn tất phiên qua POST /api/interviews/:id/complete — Nest không tự ghi heuristic khi đọc report.",
      );
    }
    const visual = session.visualSummary;
    return {
      sessionId,
      candidateName: session.user.fullName,
      targetRole: session.targetRole,
      dateFormatted: session.createdAt.toLocaleDateString("vi-VN"),
      durationFormatted: `${Math.floor(session.durationSeconds / 60)} phút ${String(session.durationSeconds % 60).padStart(2, "0")} giây`,
      overallScore: score.overallScore,
      starOverallScore: score.starOverallScore,
      technicalScore: score.technicalScore,
      visualScore: visual
        ? {
            overallScore: visual.overallScore,
            cameraGazeScore: visual.cameraGazeScore,
            headFramingScore: visual.headFramingScore,
            facialActivityScore: visual.facialActivityScore,
            movementStabilityScore: visual.stabilityScore,
            videoQualityScore: visual.videoQualityScore,
            totalBlinks: visual.totalBlinks,
            blinkFrequencyPerMin: visual.blinkFreqPerMin,
            gazeAwayCount: visual.gazeAwayCount,
            faceTouchCount: visual.faceTouchCount,
            coachingSummary: jsonArray(visual.coachingSummaryJson),
          }
        : undefined,
      questions: session.questions.map((question) => ({
        id: question.id,
        order: question.orderIndex,
        category: contractCategory(question.category),
        prompt: question.prompt,
        targetSkills: jsonArray(question.keyTakeawaysJson),
        askedAtElapsedMs: question.askedElapsedMs,
        answeredAtElapsedMs: question.answeredElapsedMs ?? undefined,
        technicalAccuracyScore: question.technicalScore ?? undefined,
        keyTakeaways: jsonArray(question.keyTakeawaysJson),
      })),
      transcripts: session.transcripts.map((transcript) => ({
        id: transcript.id,
        speaker: transcript.speaker as "interviewer" | "candidate",
        text: transcript.text,
        startElapsedMs: transcript.startElapsedMs,
        endElapsedMs: transcript.endElapsedMs,
        questionId: transcript.questionId ?? undefined,
      })),
      visualEvents: session.visualEvents.map((event) => ({
        sessionId,
        seq: event.seq,
        elapsedMs: event.elapsedMs,
        durationMs: event.durationMs ?? undefined,
        type: event.type as VisualEvent["type"],
        label: event.label,
        description: event.description,
        severity: event.severity as VisualEvent["severity"],
        associatedQuestionId: event.questionId ?? undefined,
      })),
      topStrengths: jsonArray(score.strengthsJson),
      areasForImprovement: jsonArray(score.improvementsJson),
      studyPlanRecommendations: [],
    };
  }

  private async assertSessionAccess(sessionId: string, actor: NestAuthUser): Promise<void> {
    const session = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        ...(actor.role === "ADMIN"
          ? {}
          : actor.role === "CANDIDATE"
            ? { userId: actor.userId }
            : {
                OR: [
                  { userId: actor.userId },
                  {
                    application: {
                      job: { company: { members: { some: { userId: actor.userId } } } },
                    },
                  },
                  { job: { company: { members: { some: { userId: actor.userId } } } } },
                ],
              }),
      },
      select: { id: true },
    });
    if (!session) throw new NotFoundException("Phiên interview không tồn tại.");
  }
}
