import { z } from "zod";

export const VisualEventTypeSchema = z.enum([
  "GAZE_AWAY_START",
  "GAZE_AWAY_END",
  "GAZE_DOWNWARD",
  "HEAD_OFF_CENTER",
  "FACE_NOT_VISIBLE",
  "FACE_TOUCH",
  "LOW_BRIGHTNESS",
  "UNSTABLE_MOVEMENT",
]);
export type VisualEventType = z.infer<typeof VisualEventTypeSchema>;

export const BaselineGazeCalibrationSchema = z.object({
  referenceGazeVector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  normalizedInterEyeDistance: z.number(),
  neutralHeadPose: z.object({
    yaw: z.number(),
    pitch: z.number(),
    roll: z.number(),
  }),
  calibratedAtElapsedMs: z.number(),
  sampleCount: z.number().default(90),
});
export type BaselineGazeCalibration = z.infer<typeof BaselineGazeCalibrationSchema>;

export const VisualTelemetrySampleSchema = z.object({
  sessionId: z.string(),
  seq: z.number(),
  elapsedMs: z.number(),
  gaze: z.object({
    cameraAligned: z.boolean(),
    deltaAngleDeg: z.number(),
    isGazeDownward: z.boolean(),
  }),
  headPose: z.object({
    yaw: z.number(),
    pitch: z.number(),
    roll: z.number(),
  }),
  framing: z.object({
    centerOffsetX: z.number(),
    centerOffsetY: z.number(),
    normalizedFaceScale: z.number(),
  }),
  facialActivity: z.object({
    smileScore: z.number(),
    blinkState: z.boolean(),
    eyeOpennessScore: z.number(),
  }),
  quality: z.object({
    faceVisibility: z.number(),
    brightnessScore: z.number(),
  }),
});
export type VisualTelemetrySample = z.infer<typeof VisualTelemetrySampleSchema>;

export const VisualEventSchema = z.object({
  id: z.string().uuid().optional(),
  sessionId: z.string(),
  seq: z.number(),
  elapsedMs: z.number(),
  durationMs: z.number().optional(),
  type: VisualEventTypeSchema,
  label: z.string(),
  description: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  associatedQuestionId: z.string().optional(),
});
export type VisualEvent = z.infer<typeof VisualEventSchema>;

export const VisualPresentationScoreSchema = z.object({
  overallScore: z.number().min(0).max(100),
  cameraGazeScore: z.number().min(0).max(100), // 30% weight
  headFramingScore: z.number().min(0).max(100), // 25% weight
  facialActivityScore: z.number().min(0).max(100), // 20% weight
  movementStabilityScore: z.number().min(0).max(100), // 15% weight
  videoQualityScore: z.number().min(0).max(100), // 10% weight
  totalBlinks: z.number(),
  blinkFrequencyPerMin: z.number(),
  gazeAwayCount: z.number(),
  faceTouchCount: z.number(),
  coachingSummary: z.array(z.string()),
});
export type VisualPresentationScore = z.infer<typeof VisualPresentationScoreSchema>;
