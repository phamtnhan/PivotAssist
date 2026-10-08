import { z } from "zod";
import { VisualEventSchema, VisualPresentationScoreSchema } from "./telemetry.js";

export const InterviewDifficultySchema = z.enum(["junior", "mid", "senior", "lead"]);
export type InterviewDifficulty = z.infer<typeof InterviewDifficultySchema>;

export const InterviewStatusSchema = z.enum([
  "SCHEDULED",
  "CALIBRATING",
  "IN_PROGRESS",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);
export type InterviewStatus = z.infer<typeof InterviewStatusSchema>;

export const STARBreakdownSchema = z.object({
  situationScore: z.number().min(0).max(100),
  taskScore: z.number().min(0).max(100),
  actionScore: z.number().min(0).max(100),
  resultScore: z.number().min(0).max(100),
  situationFeedback: z.string(),
  taskFeedback: z.string(),
  actionFeedback: z.string(),
  resultFeedback: z.string(),
});
export type STARBreakdown = z.infer<typeof STARBreakdownSchema>;

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  speaker: z.enum(["interviewer", "candidate"]),
  text: z.string(),
  startElapsedMs: z.number(),
  endElapsedMs: z.number(),
  questionId: z.string().optional(),
  turnId: z.string().optional(),
  parentTurnId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  sequenceNumber: z.number().int().optional(),
  mode: z.enum(["ADAPTIVE", "FALLBACK"]).optional(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const InterviewQuestionSchema = z.object({
  id: z.string(),
  order: z.number(),
  category: z.enum(["behavioral", "technical", "system_design", "domain", "culture_fit"]),
  prompt: z.string(),
  targetSkills: z.array(z.string()),
  askedAtElapsedMs: z.number(),
  answeredAtElapsedMs: z.number().optional(),
  starScore: STARBreakdownSchema.optional(),
  technicalAccuracyScore: z.number().optional(),
  sampleIdealAnswer: z.string().optional(),
  keyTakeaways: z.array(z.string()).default([]),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;

export const InterviewSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  jobId: z.string().optional(),
  applicationId: z.string().optional(),
  targetRole: z.string(),
  difficulty: InterviewDifficultySchema,
  context: z.record(z.unknown()).optional(),
  status: InterviewStatusSchema,
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  durationSeconds: z.number().default(0),
  recordingVideoUrl: z.string().optional(),
  livekitRoomName: z.string(),
  livekitToken: z.string().optional(),
  isVoiceOnly: z.boolean().default(false),
});
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;

export const InterviewCoachingReportSchema = z.object({
  sessionId: z.string(),
  candidateName: z.string(),
  targetRole: z.string(),
  dateFormatted: z.string(),
  durationFormatted: z.string(),
  overallScore: z.number().min(0).max(100),
  starOverallScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  visualScore: VisualPresentationScoreSchema.optional(),
  questions: z.array(InterviewQuestionSchema),
  transcripts: z.array(TranscriptSegmentSchema),
  visualEvents: z.array(VisualEventSchema),
  topStrengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  studyPlanRecommendations: z.array(
    z.object({
      skill: z.string(),
      reason: z.string(),
      recommendedModuleId: z.string().optional(),
    }),
  ),
});
export type InterviewCoachingReport = z.infer<typeof InterviewCoachingReportSchema>;
