// REQ-0003 — candidate DTO: candidateFacing; no score / internalReason / draft offer
import type { ApplicationStatus, OfferStatus } from "@pivotassist/contracts";
import {
  offerIsPublicToCandidate,
  parsePipelineStatus,
  toCandidateFacingStatus,
} from "@/lib/hiring-pipeline";
import { toPublicOffer } from "@/lib/hiring-service";

export function toCandidateApplicationDto(application: {
  id: string;
  userId: string;
  jobId: string;
  resumeId: string | null;
  status: string;
  appliedAt: Date | null;
  shortlistedAt: Date | null;
  faceToFaceScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  candidateMessage: string | null;
  job: { id: string; title: string; location: string; company: { name: string } };
  resume: { id: string; fileAsset: { filename: string } } | null;
  interviews: Array<{
    id: string;
    status: string;
    createdAt: Date;
    endedAt?: Date | null;
    roundIndex?: number;
  }>;
  schedules: Array<{
    id: string;
    scheduledAt: Date;
    interviewerName: string | null;
    meetingUrl: string | null;
    timezone: string;
    status: string;
  }>;
  offers?: Array<{
    id: string;
    applicationId: string;
    title: string;
    employmentType: string;
    compensationAmount: number;
    currency: string;
    startDate: Date | null;
    location: string | null;
    benefits: string | null;
    terms: string | null;
    expiresAt: Date | null;
    status: OfferStatus;
    sentAt: Date | null;
    respondedAt: Date | null;
  }>;
}) {
  const pipeline = parsePipelineStatus(application.status);
  const publicOffer =
    (application.offers ?? []).find((offer) => offerIsPublicToCandidate(offer.status)) ?? null;
  const candidateFacing = toCandidateFacingStatus({
    pipeline,
    offerStatus: publicOffer?.status ?? null,
  });
  return {
    id: application.id,
    jobId: application.jobId,
    status: pipeline,
    candidateFacing,
    candidateMessage:
      publicOffer ||
      pipeline === "REJECTED" ||
      pipeline === "ADDITIONAL_ASSESSMENT" ||
      pipeline === "HOLD"
        ? application.candidateMessage
        : null,
    appliedAt: application.appliedAt?.toISOString() ?? null,
    shortlistedAt: application.shortlistedAt?.toISOString() ?? null,
    faceToFaceScheduledAt: application.faceToFaceScheduledAt?.toISOString() ?? null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    job: application.job,
    resume: application.resume,
    interviews: application.interviews.map((session) => ({
      id: session.id,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      roundIndex: session.roundIndex ?? 1,
    })),
    schedules: application.schedules,
    offer: publicOffer ? toPublicOffer(publicOffer) : null,
  };
}

export function candidateFacingFromPipeline(
  status: ApplicationStatus,
  offerStatus?: OfferStatus | null,
) {
  return toCandidateFacingStatus({ pipeline: status, offerStatus });
}
