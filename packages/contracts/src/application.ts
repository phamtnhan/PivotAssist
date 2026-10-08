import { z } from "zod";

export const ApplicationStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "AI_INTERVIEW_PENDING",
  "AI_INTERVIEW_IN_PROGRESS",
  "AI_INTERVIEW_COMPLETED",
  "HOLD",
  "ADDITIONAL_ASSESSMENT",
  "SHORTLISTED",
  "FACE_TO_FACE_SCHEDULED",
  "OFFER_PENDING",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const CandidateFacingStatusSchema = z.enum([
  "waiting_interview",
  "in_progress",
  "completed",
  "under_review",
  "need_info",
  "next_interview",
  "offer_received",
  "not_a_fit",
  "hired",
  "withdrawn",
]);
export type CandidateFacingStatus = z.infer<typeof CandidateFacingStatusSchema>;

export const HiringDecisionActionSchema = z.enum([
  "NEXT_INTERVIEW",
  "ADDITIONAL_ASSESSMENT",
  "HOLD",
  "REJECT",
  "PROCEED_TO_OFFER",
]);
export type HiringDecisionAction = z.infer<typeof HiringDecisionActionSchema>;

export const OfferStatusSchema = z.enum([
  "DRAFT",
  "APPROVAL_PENDING",
  "APPROVED",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "WITHDRAWN",
]);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

export const ApplicationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  jobId: z.string(),
  resumeId: z.string().optional(),
  status: ApplicationStatusSchema,
  appliedAt: z.string().datetime().optional(),
  shortlistedAt: z.string().datetime().optional(),
  faceToFaceScheduledAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Application = z.infer<typeof ApplicationSchema>;
