/**
 * Hiring Pipeline Workflow:
 * - Application.status: pipeline only (SUBMITTED → AI_* → SHORTLISTED|HOLD|ADDITIONAL → OFFER_PENDING → HIRED|REJECTED|WITHDRAWN)
 * - InterviewSession.status: InterviewStatus enum (SCHEDULED…COMPLETED)
 * - InterviewScore 1:1 session = canonical AI artifact
 * - Offer + OfferApproval: HIRED only after Offer.ACCEPTED; PATCH status HIRED → 409
 * - Complete: heuristic sync + Gemini after() — không chờ LLM trên hot path
 * - BullMQ chỉ chạy khi REDIS_URL; mặc định after() trên web API
 * - RBAC: JWT role + CompanyMember tenant isolation
 * - Enterprise review: /enterprise/candidates/[id]
 */

import type {
  ApplicationStatus,
  CandidateFacingStatus,
  HiringDecisionAction,
  OfferStatus,
} from "@pivotassist/contracts";

export const PIPELINE_TERMINAL: readonly ApplicationStatus[] = ["HIRED", "REJECTED", "WITHDRAWN"];

export const DECISION_ACTIONS: readonly HiringDecisionAction[] = [
  "NEXT_INTERVIEW",
  "ADDITIONAL_ASSESSMENT",
  "HOLD",
  "REJECT",
  "PROCEED_TO_OFFER",
];

const PIPELINE_AFTER_DECISION: Record<HiringDecisionAction, ApplicationStatus> = {
  NEXT_INTERVIEW: "SHORTLISTED",
  ADDITIONAL_ASSESSMENT: "ADDITIONAL_ASSESSMENT",
  HOLD: "HOLD",
  REJECT: "REJECTED",
  PROCEED_TO_OFFER: "OFFER_PENDING",
};

const DECIDABLE: readonly ApplicationStatus[] = [
  "AI_INTERVIEW_COMPLETED",
  "AI_INTERVIEW_IN_PROGRESS",
  "HOLD",
  "ADDITIONAL_ASSESSMENT",
  "SHORTLISTED",
  "FACE_TO_FACE_SCHEDULED",
  "OFFER_PENDING",
];

export function parsePipelineStatus(value: string | null | undefined): ApplicationStatus {
  const allowed: ApplicationStatus[] = [
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
  ];
  return allowed.includes(value as ApplicationStatus) ? (value as ApplicationStatus) : "SUBMITTED";
}

export function pipelineAfterDecision(action: HiringDecisionAction): ApplicationStatus {
  return PIPELINE_AFTER_DECISION[action];
}

export function isPipelineTerminal(status: ApplicationStatus): boolean {
  return PIPELINE_TERMINAL.includes(status);
}

/** Re-apply to the same job: never reopen HIRED/REJECTED; WITHDRAWN may reopen. */
export function reapplyPolicy(status: ApplicationStatus): "reject" | "reopen" | "keep" {
  if (status === "HIRED" || status === "REJECTED") return "reject";
  if (status === "WITHDRAWN") return "reopen";
  return "keep";
}

/** Completing an AI session only advances first-cycle pipeline. Later rounds keep HOLD/SHORTLISTED/ADDITIONAL. */
export function pipelineAfterSessionComplete(status: ApplicationStatus): ApplicationStatus | null {
  if (
    status === "SUBMITTED" ||
    status === "AI_INTERVIEW_PENDING" ||
    status === "AI_INTERVIEW_IN_PROGRESS"
  ) {
    return "AI_INTERVIEW_COMPLETED";
  }
  return null;
}

export function canDecideFrom(
  status: ApplicationStatus,
  action: HiringDecisionAction,
  options?: {
    hasReadyEvaluation?: boolean;
    hasActiveOffer?: boolean;
    offerStatus?: OfferStatus | null;
  },
): { ok: true } | { ok: false; reason: string } {
  if (isPipelineTerminal(status)) {
    if (action === "REJECT" && status === "REJECTED") return { ok: true };
    return { ok: false, reason: "Hồ sơ đã đóng và không thể chuyển bước." };
  }
  if (!DECIDABLE.includes(status)) {
    return { ok: false, reason: "Hồ sơ chưa đến bước có thể ra quyết định." };
  }
  if (
    action !== "REJECT" &&
    options?.hasReadyEvaluation === false &&
    status !== "FACE_TO_FACE_SCHEDULED" &&
    status !== "SHORTLISTED"
  ) {
    return {
      ok: false,
      reason: "Cần hoàn tất phỏng vấn AI và có đánh giá trước khi ra quyết định.",
    };
  }
  if (status === "OFFER_PENDING") {
    if (options?.offerStatus === "SENT") {
      if (action === "REJECT" || action === "PROCEED_TO_OFFER") {
        return { ok: false, reason: "Đề nghị đang chờ phản hồi — hãy thu hồi đề nghị trước." };
      }
    }
    if (action === "PROCEED_TO_OFFER" && options?.hasActiveOffer) {
      return { ok: true };
    }
  }
  if (action === "PROCEED_TO_OFFER" && options?.hasActiveOffer && status === "OFFER_PENDING") {
    return { ok: true };
  }
  return { ok: true };
}

export function toCandidateFacingStatus(input: {
  pipeline: ApplicationStatus;
  offerStatus?: OfferStatus | null;
}): CandidateFacingStatus {
  if (input.offerStatus === "SENT") return "offer_received";
  if (input.offerStatus === "ACCEPTED" || input.pipeline === "HIRED") return "hired";
  switch (input.pipeline) {
    case "AI_INTERVIEW_PENDING":
    case "SUBMITTED":
    case "DRAFT":
      return "waiting_interview";
    case "AI_INTERVIEW_IN_PROGRESS":
      return "in_progress";
    case "AI_INTERVIEW_COMPLETED":
      return "completed";
    case "HOLD":
    case "OFFER_PENDING":
      return "under_review";
    case "ADDITIONAL_ASSESSMENT":
      return "need_info";
    case "SHORTLISTED":
    case "FACE_TO_FACE_SCHEDULED":
      return "next_interview";
    case "REJECTED":
      return "not_a_fit";
    case "WITHDRAWN":
      return "withdrawn";
    default:
      return "under_review";
  }
}

export function canTransitionOffer(from: OfferStatus, to: OfferStatus): boolean {
  const allowed: Record<OfferStatus, OfferStatus[]> = {
    DRAFT: ["APPROVAL_PENDING", "WITHDRAWN"],
    APPROVAL_PENDING: ["APPROVED", "DRAFT", "WITHDRAWN"],
    APPROVED: ["SENT", "APPROVAL_PENDING", "WITHDRAWN"],
    SENT: ["ACCEPTED", "DECLINED", "EXPIRED", "WITHDRAWN"],
    ACCEPTED: [],
    DECLINED: [],
    EXPIRED: [],
    WITHDRAWN: [],
  };
  return allowed[from].includes(to);
}

export function offerIsActive(status: OfferStatus): boolean {
  return (
    status === "DRAFT" ||
    status === "APPROVAL_PENDING" ||
    status === "APPROVED" ||
    status === "SENT"
  );
}

export function offerIsPublicToCandidate(status: OfferStatus): boolean {
  return (
    status === "SENT" ||
    status === "ACCEPTED" ||
    status === "DECLINED" ||
    status === "EXPIRED" ||
    status === "WITHDRAWN"
  );
}

export function materialHashForOffer(input: {
  title: string;
  employmentType: string;
  compensationAmount: number;
  currency: string;
  startDate: string | null;
  location: string | null;
  benefits: string | null;
  terms: string | null;
}): string {
  return [
    input.title.trim(),
    input.employmentType.trim(),
    String(input.compensationAmount),
    input.currency.trim().toUpperCase(),
    input.startDate ?? "",
    (input.location ?? "").trim(),
    (input.benefits ?? "").trim(),
    (input.terms ?? "").trim(),
  ].join("\u001f");
}

export function isMaterialOfferChange(previousHash: string, nextHash: string): boolean {
  return previousHash !== nextHash;
}

export function recommendationFromScore(overallScore: number): "ADVANCE" | "HOLD" | "REJECT" {
  if (overallScore >= 80) return "ADVANCE";
  if (overallScore >= 60) return "HOLD";
  return "REJECT";
}

export function defaultRejectCandidateMessage(jobTitle: string): string {
  return `Cảm ơn bạn đã hoàn tất vòng phỏng vấn cho vị trí ${jobTitle}. Hồ sơ chưa phù hợp với nhu cầu hiện tại.`;
}

export function decisionIdempotencyKey(action: HiringDecisionAction, version: number): string {
  return `${action}:v${version}`;
}

export class HiringConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "HiringConflictError";
  }
}

export class HiringForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "HiringForbiddenError";
  }
}

export class HiringNotFoundError extends Error {
  readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = "HiringNotFoundError";
  }
}

export class HiringInputError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "HiringInputError";
  }
}
