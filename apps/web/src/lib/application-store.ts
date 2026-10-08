import {
  ApplicationStatusSchema,
  CandidateFacingStatusSchema,
  type ApplicationStatus,
  type CandidateFacingStatus,
} from "@pivotassist/contracts";

export interface CandidateApplicationRecord {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  resumeName: string;
  status: ApplicationStatus;
  appliedAt: string;
  interviewId?: string;
  faceToFaceScheduledAt?: string | null;
  interviewerName?: string | null;
  meetingUrl?: string | null;
  scheduleTimezone?: string | null;
  scheduleId?: string | null;
  candidateFacing?: CandidateFacingStatus;
  candidateMessage?: string | null;
  offer?: {
    id: string;
    title: string;
    compensationAmount: number;
    currency: string;
    employmentType: string;
    location: string | null;
    startDate: string | null;
    benefits: string | null;
    terms: string | null;
    expiresAt: string | null;
    status: string;
  } | null;
}

export interface ServerApplicationPayload {
  id: string;
  jobId: string;
  status: string;
  appliedAt?: string | null;
  createdAt: string;
  job?: { title?: string; company?: { name?: string } | null } | null;
  resume?: { fileAsset?: { filename?: string } | null } | null;
  interviews?: Array<{
    id: string;
    status?: string;
    createdAt?: string;
    interviewScore?: { overallScore?: number } | null;
  }>;
  schedules?: Array<{
    id?: string;
    scheduledAt?: string | Date | null;
    interviewerName?: string | null;
    meetingUrl?: string | null;
    timezone?: string | null;
    status?: string | null;
  }>;
  faceToFaceScheduledAt?: string | Date | null;
  candidateFacing?: string;
  candidateMessage?: string | null;
  offer?: CandidateApplicationRecord["offer"];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function fromServerApplication(
  application: ServerApplicationPayload,
): CandidateApplicationRecord {
  const statusResult = ApplicationStatusSchema.safeParse(application.status);
  const latestInterview = application.interviews?.[0];
  const latestSchedule =
    [...(application.schedules ?? [])]
      .filter((item) => item.status !== "CANCELLED")
      .sort((a, b) => {
        const left = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
        const right = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
        return right - left;
      })[0] ?? application.schedules?.[0];
  const scheduledAt = latestSchedule?.scheduledAt ?? application.faceToFaceScheduledAt;
  return {
    applicationId: application.id,
    jobId: application.jobId,
    jobTitle: application.job?.title ?? "Tin chưa tải tên",
    company: application.job?.company?.name ?? "Doanh nghiệp",
    resumeName: application.resume?.fileAsset?.filename ?? "Chưa chọn CV",
    status: statusResult.success ? statusResult.data : "SUBMITTED",
    appliedAt: formatDate(application.appliedAt ?? application.createdAt),
    interviewId: latestInterview?.id,
    candidateFacing: CandidateFacingStatusSchema.safeParse(application.candidateFacing).success
      ? (application.candidateFacing as CandidateFacingStatus)
      : undefined,
    candidateMessage: application.candidateMessage ?? null,
    offer: application.offer ?? null,
    faceToFaceScheduledAt: scheduledAt
      ? formatDate(typeof scheduledAt === "string" ? scheduledAt : scheduledAt.toISOString())
      : null,
    interviewerName: latestSchedule?.interviewerName ?? null,
    meetingUrl: latestSchedule?.meetingUrl ?? null,
    scheduleTimezone: latestSchedule?.timezone ?? null,
    scheduleId: latestSchedule?.id ?? null,
  };
}

export function isDemoApplicationId(applicationId: string): boolean {
  return applicationId.startsWith("app_demo_") || applicationId.startsWith("app_public_");
}
