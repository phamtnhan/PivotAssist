import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { sanitizeInterviewPrompt } from "@/lib/interview-copy";
import { accessibleApplicationWhere, isEnterpriseUser } from "@/lib/enterprise-server";
import { parsePipelineStatus, toCandidateFacingStatus } from "@/lib/hiring-pipeline";
import { errorResponse, iso } from "@/lib/server-utils";

function arrayJson(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem đánh giá buổi phỏng vấn AI.", 401);
  const { id } = await context.params;

  try {
    const accessWhere =
      user.role === "CANDIDATE"
        ? { userId: user.userId }
        : isEnterpriseUser(user)
          ? { application: accessibleApplicationWhere(user) }
          : { userId: user.userId };
    const session = await prisma.interviewSession.findFirst({
      where: { id, ...accessWhere },
      select: {
        id: true,
        applicationId: true,
        jobId: true,
        targetRole: true,
        status: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        recordingStatus: true,
        recordingSharedAt: true,
        recordingAsset: { select: { filename: true, mimeType: true, fileSizeBytes: true } },
        job: { select: { id: true, title: true } },
        application: {
          select: {
            id: true,
            status: true,
            user: { select: { id: true, fullName: true, email: true } },
            job: { select: { id: true, title: true } },
          },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            orderIndex: true,
            category: true,
            prompt: true,
            keyTakeawaysJson: true,
            askedElapsedMs: true,
            answeredElapsedMs: true,
            technicalScore: true,
            starSituationScore: true,
            starTaskScore: true,
            starActionScore: true,
            starResultScore: true,
          },
        },
        interviewScore: true,
        visualSummary: true,
        transcripts: {
          orderBy: [{ sequenceNumber: "asc" }, { timestamp: "asc" }, { startElapsedMs: "asc" }],
          take: 200,
          select: {
            id: true,
            speaker: true,
            text: true,
            startElapsedMs: true,
            questionId: true,
            turnId: true,
            parentTurnId: true,
            sequenceNumber: true,
            timestamp: true,
            mode: true,
          },
        },
        visualEvents: {
          orderBy: { elapsedMs: "asc" },
          take: 200,
          select: { id: true, type: true, label: true, elapsedMs: true, severity: true },
        },
        feedbackItems: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            targetSkill: true,
            reason: true,
            suggestedAction: true,
            severity: true,
          },
        },
      },
    });
    if (!session)
      return errorResponse(
        "Phiên phỏng vấn AI không tồn tại hoặc bạn không có quyền truy cập.",
        404,
      );

    const score = session.interviewScore;
    const canSeeRecording = user.role === "CANDIDATE" || Boolean(session.recordingSharedAt);
    const evaluationStatus =
      score?.evaluationStatus ??
      (session.status === "COMPLETED"
        ? "PROCESSING"
        : session.status === "FAILED"
          ? "FAILED"
          : "NOT_STARTED");
    const hideInternal = user.role === "CANDIDATE" && Boolean(session.applicationId);
    if (hideInternal) {
      const pipeline = parsePipelineStatus(session.application?.status);
      return NextResponse.json({
        success: true,
        audience: "candidate",
        report: {
          sessionId: session.id,
          applicationId: session.applicationId,
          jobId: session.jobId ?? session.application?.job.id ?? null,
          jobTitle: session.job?.title ?? session.application?.job.title ?? null,
          candidate: null,
          targetRole: session.targetRole,
          sessionStatus: session.status,
          candidateFacing: toCandidateFacingStatus({ pipeline }),
          startedAt: iso(session.startedAt),
          endedAt: iso(session.endedAt),
          durationSeconds: session.durationSeconds,
          evaluationStatus,
          completed: session.status === "COMPLETED",
          recording:
            canSeeRecording && session.recordingStatus === "READY" && session.recordingAsset
              ? {
                  status: session.recordingStatus,
                  sharedAt: iso(session.recordingSharedAt),
                  filename: session.recordingAsset.filename,
                  mimeType: session.recordingAsset.mimeType,
                  playbackUrl: `/api/interviews/${encodeURIComponent(session.id)}/recording`,
                }
              : null,
          score: null,
          adaptiveEvidence: null,
          visualSummary: null,
          questions: session.questions.map((question) => ({
            id: question.id,
            order: question.orderIndex,
            category: question.category,
            prompt: sanitizeInterviewPrompt(question.prompt),
          })),
          transcripts: [],
          visualEvents: [],
          feedback: [],
        },
      });
    }

    return NextResponse.json({
      success: true,
      audience: user.role === "CANDIDATE" ? "practice" : "enterprise",
      report: {
        sessionId: session.id,
        applicationId: session.applicationId,
        jobId: session.jobId ?? session.application?.job.id ?? null,
        jobTitle: session.job?.title ?? session.application?.job.title ?? null,
        candidate: session.application?.user ?? null,
        targetRole: session.targetRole,
        sessionStatus: session.status,
        applicationStatus: session.application?.status ?? null,
        startedAt: iso(session.startedAt),
        endedAt: iso(session.endedAt),
        durationSeconds: session.durationSeconds,
        evaluationStatus,
        recording:
          canSeeRecording && session.recordingStatus === "READY" && session.recordingAsset
            ? {
                status: session.recordingStatus,
                sharedAt: iso(session.recordingSharedAt),
                filename: session.recordingAsset.filename,
                mimeType: session.recordingAsset.mimeType,
                playbackUrl: `/api/interviews/${encodeURIComponent(session.id)}/recording`,
              }
            : null,
        recommendation: score?.recommendation ?? null,
        summaryText: score?.summaryText ?? null,
        adaptiveEvidence: user.role === "CANDIDATE" ? null : (score?.adaptiveReportJson ?? null),
        score: score
          ? {
              overallScore: score.overallScore,
              starOverallScore: score.starOverallScore,
              technicalScore: score.technicalScore,
              visualScore: score.visualScore,
              strengths: arrayJson(score.strengthsJson),
              improvements: arrayJson(score.improvementsJson),
              modelName: score.modelName,
              narrativeStatus: score.narrativeStatus ?? null,
              questionEvalStatus: score.questionEvalStatus ?? null,
              recommendation: score.recommendation ?? null,
              createdAt: score.createdAt.toISOString(),
              updatedAt: score.updatedAt.toISOString(),
            }
          : null,
        visualSummary: session.visualSummary
          ? {
              overallScore: session.visualSummary.overallScore,
              cameraGazeScore: session.visualSummary.cameraGazeScore,
              headFramingScore: session.visualSummary.headFramingScore,
              facialActivityScore: session.visualSummary.facialActivityScore,
              stabilityScore: session.visualSummary.stabilityScore,
              videoQualityScore: session.visualSummary.videoQualityScore,
              coachingSummary: arrayJson(session.visualSummary.coachingSummaryJson),
            }
          : null,
        questions: session.questions.map((question) => ({
          id: question.id,
          order: question.orderIndex,
          category: question.category,
          prompt: sanitizeInterviewPrompt(question.prompt),
          targetSkills: arrayJson(question.keyTakeawaysJson),
          askedAtElapsedMs: question.askedElapsedMs,
          answeredAtElapsedMs: question.answeredElapsedMs,
          technicalScore: question.technicalScore,
          star: {
            situationScore: question.starSituationScore,
            taskScore: question.starTaskScore,
            actionScore: question.starActionScore,
            resultScore: question.starResultScore,
          },
          keyTakeaways: arrayJson(question.keyTakeawaysJson),
        })),
        transcripts: session.transcripts.map((row) => ({
          id: row.id,
          speaker: row.speaker,
          text: row.text,
          startElapsedMs: row.startElapsedMs,
          questionId: row.questionId,
          turnId: row.turnId,
          parentTurnId: row.parentTurnId,
          sequenceNumber: row.sequenceNumber,
          timestamp: row.timestamp,
          mode: row.mode,
        })),
        visualEvents: session.visualEvents.map((row) => ({
          type: row.type,
          label: row.label,
          elapsedMs: row.elapsedMs,
          severity: row.severity,
        })),
        feedback: session.feedbackItems,
      },
    });
  } catch (error: any) {
    console.error("[Interview Report GET]", error?.message ?? error);
    return errorResponse("Không thể tải đánh giá buổi phỏng vấn AI.", 503);
  }
}
