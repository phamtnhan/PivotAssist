import { Job } from "bullmq";
import { evaluateInterview } from "@pivotassist/free-ai";
import { prisma } from "@pivotassist/db";

export interface GenerateReportJobData {
  sessionId: string;
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function processReportGeneration(job: Job<GenerateReportJobData>) {
  const { sessionId } = job.data;
  console.log(`[Worker] Synthesizing free evaluation for sessionId=${sessionId}`);
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      job: { select: { title: true, descriptionRaw: true, rubricJson: true } },
      application: { select: { resume: { select: { parsedText: true } } } },
      questions: { orderBy: { orderIndex: "asc" } },
      transcripts: { orderBy: { startElapsedMs: "asc" } },
      visualEvents: { orderBy: { seq: "asc" } },
      interviewScore: true,
    },
  });
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (session.interviewScore?.modelName?.startsWith("gemini")) {
    return {
      success: true,
      sessionId,
      skipped: true,
      reason: "already-gemini",
      overallScore: session.interviewScore.overallScore,
    };
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    throw new Error(
      "GEMINI_API_KEY có — worker không ghi heuristic. Dùng POST /api/interviews/:id/complete.",
    );
  }

  const sessionContext =
    session.contextJson &&
    typeof session.contextJson === "object" &&
    !Array.isArray(session.contextJson)
      ? (session.contextJson as { job?: { description?: string } })
      : {};
  const evaluation = evaluateInterview({
    jobTitle: session.job?.title ?? session.targetRole,
    jobDescription: session.job?.descriptionRaw ?? sessionContext.job?.description ?? "",
    resumeText: session.application?.resume?.parsedText ?? "",
    rubric: Array.isArray(session.job?.rubricJson)
      ? (session.job.rubricJson as Array<{ label: string; weight: number; description?: string }>)
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
    visualEvents: session.visualEvents.map((event) => ({
      type: event.type,
      severity: event.severity,
    })),
  });

  await prisma.$transaction(async (tx) => {
    await tx.interviewSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", failureReason: null, processingStartedAt: null },
    });
    await tx.interviewScore.upsert({
      where: { sessionId },
      create: {
        sessionId,
        overallScore: evaluation.overallScore,
        starOverallScore: evaluation.starOverallScore,
        technicalScore: evaluation.technicalScore,
        visualScore: evaluation.visualScore,
        strengthsJson: jsonValue(evaluation.strengths),
        improvementsJson: jsonValue(evaluation.improvements),
        evaluationStatus: "READY",
        modelName: "free-heuristic-v1",
        rubricJson: session.job?.rubricJson ? jsonValue(session.job.rubricJson) : undefined,
      },
      update: {
        overallScore: evaluation.overallScore,
        starOverallScore: evaluation.starOverallScore,
        technicalScore: evaluation.technicalScore,
        visualScore: evaluation.visualScore,
        strengthsJson: jsonValue(evaluation.strengths),
        improvementsJson: jsonValue(evaluation.improvements),
        evaluationStatus: "READY",
        modelName: "free-heuristic-v1",
        rubricJson: session.job?.rubricJson ? jsonValue(session.job.rubricJson) : undefined,
      },
    });
    await tx.visualSummary.upsert({
      where: { sessionId },
      create: {
        sessionId,
        overallScore: evaluation.visualSummary.overallScore,
        cameraGazeScore: evaluation.visualSummary.cameraGazeScore,
        headFramingScore: evaluation.visualSummary.headFramingScore,
        facialActivityScore: evaluation.visualSummary.facialActivityScore,
        stabilityScore: evaluation.visualSummary.stabilityScore,
        videoQualityScore: evaluation.visualSummary.videoQualityScore,
        totalBlinks: evaluation.visualSummary.totalBlinks,
        blinkFreqPerMin: evaluation.visualSummary.blinkFreqPerMin,
        gazeAwayCount: evaluation.visualSummary.gazeAwayCount,
        faceTouchCount: evaluation.visualSummary.faceTouchCount,
        coachingSummaryJson: jsonValue(evaluation.visualSummary.coachingSummary),
      },
      update: {
        overallScore: evaluation.visualSummary.overallScore,
        cameraGazeScore: evaluation.visualSummary.cameraGazeScore,
        headFramingScore: evaluation.visualSummary.headFramingScore,
        facialActivityScore: evaluation.visualSummary.facialActivityScore,
        stabilityScore: evaluation.visualSummary.stabilityScore,
        videoQualityScore: evaluation.visualSummary.videoQualityScore,
        totalBlinks: evaluation.visualSummary.totalBlinks,
        blinkFreqPerMin: evaluation.visualSummary.blinkFreqPerMin,
        gazeAwayCount: evaluation.visualSummary.gazeAwayCount,
        faceTouchCount: evaluation.visualSummary.faceTouchCount,
        coachingSummaryJson: jsonValue(evaluation.visualSummary.coachingSummary),
      },
    });
    await tx.interviewFeedback.deleteMany({ where: { sessionId } });
    if (evaluation.feedback.length > 0)
      await tx.interviewFeedback.createMany({
        data: evaluation.feedback.map((item) => ({ sessionId, ...item })),
      });
    for (const row of evaluation.questionScores) {
      await tx.interviewQuestion.update({
        where: { id: row.questionId },
        data: {
          technicalScore: row.technicalScore,
          starSituationScore: row.situationScore,
          starTaskScore: row.taskScore,
          starActionScore: row.actionScore,
          starResultScore: row.resultScore,
          keyTakeawaysJson: jsonValue(row.keyTakeaways),
        },
      });
    }
    if (session.applicationId)
      await tx.application.update({
        where: { id: session.applicationId },
        data: { status: "AI_INTERVIEW_COMPLETED" },
      });
  });
  return { success: true, sessionId, overallScore: evaluation.overallScore };
}
