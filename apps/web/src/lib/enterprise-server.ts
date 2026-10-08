// REQ-0004 — enterprise application access scoped by CompanyMember
// REQ-0035 — list DTOs omit candidatePhone (detail GET may keep it)
import type { ApplicationStatus } from "@pivotassist/contracts";
import { ApplicationStatusSchema } from "@pivotassist/contracts";
import { prisma } from "@pivotassist/db";
import type { Prisma } from "@prisma/client";
import type { AuthUserPayload } from "@/lib/auth";
import type {
  EnterpriseApplication,
  EnterpriseJob,
  EnterpriseRubricItem,
} from "@/data/enterprise-data";

export const ENTERPRISE_ROLES = ["RECRUITER", "ADMIN"] as const;
type EnterpriseUser = AuthUserPayload & { role: (typeof ENTERPRISE_ROLES)[number] };

export type EnterpriseCapability =
  | "workspace:write"
  | "members:write"
  | "jobs:write"
  | "pipeline:write"
  | "interview:write"
  | "offers:write";

type CompanyMemberRole = "OWNER" | "ADMIN" | "RECRUITER" | "INTERVIEWER";

const CAPABILITY_ROLES: Record<EnterpriseCapability, CompanyMemberRole[]> = {
  "workspace:write": ["OWNER", "ADMIN"],
  "members:write": ["OWNER", "ADMIN"],
  "jobs:write": ["OWNER", "ADMIN", "RECRUITER"],
  "pipeline:write": ["OWNER", "ADMIN", "RECRUITER"],
  "interview:write": ["OWNER", "ADMIN", "RECRUITER", "INTERVIEWER"],
  "offers:write": ["OWNER", "ADMIN", "RECRUITER"],
};

export function isEnterpriseUser(user: AuthUserPayload | null): user is EnterpriseUser {
  return Boolean(user && ENTERPRISE_ROLES.includes(user.role as (typeof ENTERPRISE_ROLES)[number]));
}

export async function requireEnterpriseUser(
  user: AuthUserPayload | null,
): Promise<EnterpriseUser | null> {
  if (!user) return null;
  if (user.role !== "ADMIN" && user.role !== "RECRUITER") return null;
  return user as EnterpriseUser;
}

/**
 * Global User.role identifies that an account may enter the enterprise surface.
 * CompanyMember.role is the tenant capability boundary for mutations.
 */
export async function hasEnterpriseCapability(
  user: AuthUserPayload | null,
  capability: EnterpriseCapability,
  companyId?: string,
): Promise<boolean> {
  if (!isEnterpriseUser(user)) return false;
  if (user.role === "ADMIN") return true;

  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.userId, ...(companyId ? { companyId } : {}) },
    select: { role: true },
  });
  if (!membership) return false;
  return CAPABILITY_ROLES[capability].includes(membership.role as CompanyMemberRole);
}

export const ENTERPRISE_APPLICATION_LIST_SELECT = {
  id: true,
  jobId: true,
  status: true,
  appliedAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      profile: { select: { currentJobTitle: true, yearsOfExperience: true } },
    },
  },
  resume: { select: { fileAsset: { select: { filename: true } } } },
  interviews: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      status: true,
      createdAt: true,
      endedAt: true,
      durationSeconds: true,
      recordingSharedAt: true,
      recordingStatus: true,
      recordingAsset: { select: { filename: true } },
      interviewScore: { select: { overallScore: true } },
    },
  },
} satisfies Prisma.ApplicationSelect;

export const ENTERPRISE_JOB_LIST_SELECT = {
  id: true,
  title: true,
  department: true,
  location: true,
  employmentType: true,
  salaryRange: true,
  createdAt: true,
  hiringCount: true,
  isPublished: true,
  archivedAt: true,
  company: { select: { id: true, name: true } },
  applications: {
    orderBy: { createdAt: "desc" as const },
    select: ENTERPRISE_APPLICATION_LIST_SELECT,
  },
} satisfies Prisma.JobSelect;

export const ENTERPRISE_JOB_INCLUDE = {
  company: { select: { id: true, name: true } },
  applications: {
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: { select: { currentJobTitle: true, yearsOfExperience: true } },
        },
      },
      resume: { select: { rawJson: true, fileAsset: { select: { filename: true } } } },
      interviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          endedAt: true,
          durationSeconds: true,
          recordingSharedAt: true,
          recordingStatus: true,
          recordingAsset: { select: { filename: true } },
          interviewScore: { select: { overallScore: true } },
        },
      },
    },
  },
} satisfies Prisma.JobInclude;

export type EnterpriseJobRecord = Prisma.JobGetPayload<{
  include: typeof ENTERPRISE_JOB_INCLUDE;
}>;

export type EnterpriseJobListRecord = Prisma.JobGetPayload<{
  select: typeof ENTERPRISE_JOB_LIST_SELECT;
}>;

export const ENTERPRISE_APPLICATION_INCLUDE = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      profile: { select: { currentJobTitle: true, yearsOfExperience: true, phone: true } },
    },
  },
  job: {
    include: {
      company: { select: { id: true, name: true, members: { select: { userId: true } } } },
    },
  },
  resume: { select: { rawJson: true, fileAsset: { select: { filename: true } } } },
  interviews: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      endedAt: true,
      durationSeconds: true,
      recordingSharedAt: true,
      recordingStatus: true,
      recordingAsset: { select: { filename: true } },
      interviewScore: { select: { overallScore: true } },
    },
  },
} satisfies Prisma.ApplicationInclude;

export type EnterpriseApplicationRecord = Prisma.ApplicationGetPayload<{
  include: typeof ENTERPRISE_APPLICATION_INCLUDE;
}>;

type EnterpriseApplicationSource = {
  id: string;
  jobId: string;
  status: string;
  appliedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    profile: {
      currentJobTitle: string | null;
      yearsOfExperience: number;
      phone?: string | null;
    } | null;
  };
  resume: { rawJson?: unknown; fileAsset: { filename: string } } | null;
  interviews: Array<{
    id: string;
    status: string;
    createdAt: Date;
    endedAt: Date | null;
    durationSeconds: number;
    recordingSharedAt: Date | null;
    recordingStatus: string;
    recordingAsset: { filename: string } | null;
    interviewScore: { overallScore: number } | null;
  }>;
};

export function accessibleJobWhere(user: AuthUserPayload): Prisma.JobWhereInput {
  if (user.role === "ADMIN") return {};
  return { company: { members: { some: { userId: user.userId } } } };
}

export function accessibleApplicationWhere(user: AuthUserPayload): Prisma.ApplicationWhereInput {
  if (user.role === "ADMIN") return {};
  return { job: { company: { members: { some: { userId: user.userId } } } } };
}

export function accessibleInterviewSessionWhere(
  user: AuthUserPayload,
): Prisma.InterviewSessionWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "CANDIDATE") return { userId: user.userId };
  return {
    OR: [{ application: { job: accessibleJobWhere(user) } }, { job: accessibleJobWhere(user) }],
  };
}

function formatDate(value: Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.toISOString();
}

function formatDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  return String(seconds);
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function textLines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function parseRubric(value: Prisma.JsonValue | null | undefined): EnterpriseRubricItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.label !== "string" || typeof candidate.weight !== "number") return [];
    return [
      {
        label: candidate.label,
        weight: Math.max(0, Math.min(100, candidate.weight)),
        description:
          typeof candidate.description === "string"
            ? candidate.description
            : "Tiêu chí đánh giá của tin tuyển dụng.",
      },
    ];
  });
}

function parseApplicationStatus(value: string): ApplicationStatus {
  const result = ApplicationStatusSchema.safeParse(value);
  return result.success ? result.data : "SUBMITTED";
}

const TERMINAL_OR_ADVANCED: ApplicationStatus[] = [
  "SHORTLISTED",
  "FACE_TO_FACE_SCHEDULED",
  "HOLD",
  "ADDITIONAL_ASSESSMENT",
  "OFFER_PENDING",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

function effectiveStatus(status: ApplicationStatus, hasScore: boolean): ApplicationStatus {
  if (TERMINAL_OR_ADVANCED.includes(status) || !hasScore) return status;
  return "AI_INTERVIEW_COMPLETED";
}

function nextActionFor(status: ApplicationStatus, hasScore: boolean): string {
  if (!hasScore && status !== "REJECTED" && status !== "WITHDRAWN") return "wait_ai";
  if (status === "AI_INTERVIEW_COMPLETED") return "review";
  if (status === "HOLD") return "review";
  if (status === "ADDITIONAL_ASSESSMENT") return "review";
  if (status === "SHORTLISTED") return "make_room";
  if (status === "FACE_TO_FACE_SCHEDULED") return "confirm_room";
  if (status === "OFFER_PENDING") return "offer";
  if (status === "HIRED") return "hired";
  if (status === "REJECTED") return "rejected";
  if (status === "WITHDRAWN") return "withdrawn";
  return "watch";
}

async function persistStatusIfStale(
  applicationId: string,
  current: string,
  next: ApplicationStatus,
) {
  if (current === next) return;
  await prisma.application
    .update({ where: { id: applicationId }, data: { status: next } })
    .catch(() => null);
}

function parsedCvMeta(resume: EnterpriseApplicationSource["resume"]): {
  summary?: string;
  skills?: string[];
} {
  const raw = resume?.rawJson;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const skills = Array.isArray(record.extractedSkills)
    ? record.extractedSkills.filter((item): item is string => typeof item === "string")
    : [];
  const summary =
    typeof record.summary === "string" && record.summary.trim()
      ? record.summary.trim().slice(0, 600)
      : undefined;
  return { summary, skills: skills.slice(0, 12) };
}

export function toEnterpriseApplication(
  application: EnterpriseApplicationSource,
  cvMatch?: number,
  opts?: { includePhone?: boolean },
): EnterpriseApplication {
  const scoredInterview =
    application.interviews.find(
      (interview) => typeof interview.interviewScore?.overallScore === "number",
    ) ?? application.interviews[0];
  const interviewScore = scoredInterview?.interviewScore?.overallScore;
  const originalStatus = application.status;
  const status = effectiveStatus(
    parseApplicationStatus(originalStatus),
    typeof interviewScore === "number",
  );
  if (status !== originalStatus) {
    application.status = status;
    void persistStatusIfStale(application.id, originalStatus, status);
  }
  const candidateName = application.user.fullName;
  const years = application.user.profile?.yearsOfExperience ?? 0;
  const cvMeta = parsedCvMeta(application.resume);

  return {
    id: application.id,
    jobId: application.jobId,
    candidateId: application.user.id,
    candidateName,
    candidateEmail: application.user.email,
    ...(opts?.includePhone === false
      ? {}
      : { candidatePhone: application.user.profile?.phone ?? undefined }),
    candidateRole: application.user.profile?.currentJobTitle ?? "",
    initials: initialsFor(candidateName),
    experience: years > 0 ? String(years) : "",
    resumeName: application.resume?.fileAsset.filename ?? "",
    submittedAt: formatDate(application.appliedAt ?? application.createdAt) ?? "—",
    status,
    cvMatch,
    cvSummary: cvMeta.summary,
    cvSkills: cvMeta.skills,
    interviewScore: typeof interviewScore === "number" ? interviewScore : undefined,
    interviewId: scoredInterview?.id,
    interviewDuration: formatDuration(scoredInterview?.durationSeconds),
    completedAt: formatDate(scoredInterview?.endedAt),
    interviewRecording:
      scoredInterview?.recordingStatus === "READY" &&
      scoredInterview.recordingSharedAt &&
      scoredInterview.recordingAsset
        ? {
            sharedAt: scoredInterview.recordingSharedAt.toISOString(),
            playbackUrl: `/api/interviews/${encodeURIComponent(scoredInterview.id)}/recording`,
            filename: scoredInterview.recordingAsset.filename,
          }
        : undefined,
    signal: typeof interviewScore === "number" ? "scored" : "unscored",
    nextAction: nextActionFor(status, typeof interviewScore === "number"),
  };
}

async function loadCvMatchMap(
  pairs: Array<{ userId: string; jobId: string }>,
): Promise<Map<string, number>> {
  if (pairs.length === 0) return new Map();
  const matches = await prisma.jobMatch.findMany({
    where: { OR: pairs.map((pair) => ({ userId: pair.userId, jobId: pair.jobId })) },
    select: { userId: true, jobId: true, overallScore: true },
  });
  return new Map(matches.map((match) => [`${match.userId}:${match.jobId}`, match.overallScore]));
}

type EnterpriseJobSource = Pick<
  EnterpriseJobListRecord,
  | "id"
  | "title"
  | "department"
  | "location"
  | "employmentType"
  | "salaryRange"
  | "createdAt"
  | "hiringCount"
  | "isPublished"
  | "company"
  | "applications"
> & {
  descriptionRaw?: string | null;
  rubricJson?: Prisma.JsonValue | null;
};

export function toEnterpriseJob(
  job: EnterpriseJobSource,
  matchMap?: Map<string, number>,
): EnterpriseJob & { companyName: string; applications: EnterpriseApplication[] } {
  const description = textLines(job.descriptionRaw);
  return {
    id: job.id,
    title: job.title,
    department: job.department ?? "",
    location: job.location,
    employmentType: job.employmentType,
    salaryRange: job.salaryRange ?? "",
    openedAt: formatDate(job.createdAt) ?? "—",
    hiringCount: job.hiringCount,
    status: job.isPublished ? "open" : "paused",
    description,
    requirements: description,
    rubric: parseRubric(job.rubricJson),
    companyName: job.company.name,
    applications: [
      ...job.applications.map((application) => {
        const stored = matchMap?.get(`${application.user.id}:${job.id}`);
        return toEnterpriseApplication(application, stored, { includePhone: false });
      }),
    ].sort((a, b) => (b.interviewScore ?? -1) - (a.interviewScore ?? -1)),
  };
}

export async function mapEnterpriseJobs(jobs: EnterpriseJobSource[]) {
  const matchMap = await loadCvMatchMap(
    jobs.flatMap((job) =>
      job.applications.map((application) => ({ userId: application.user.id, jobId: job.id })),
    ),
  );
  return jobs.map((job) => toEnterpriseJob(job, matchMap));
}

export async function mapEnterpriseApplication(application: EnterpriseApplicationRecord) {
  const matchMap = await loadCvMatchMap([
    { userId: application.user.id, jobId: application.jobId },
  ]);
  const stored = matchMap.get(`${application.user.id}:${application.jobId}`);
  return toEnterpriseApplication(application, stored);
}

export async function mapEnterpriseApplications(applications: EnterpriseApplicationSource[]) {
  const matchMap = await loadCvMatchMap(
    applications.map((application) => ({ userId: application.user.id, jobId: application.jobId })),
  );
  return applications.map((application) => {
    const stored = matchMap.get(`${application.user.id}:${application.jobId}`);
    return toEnterpriseApplication(application, stored, { includePhone: false });
  });
}

export async function findAccessibleJobs(
  user: AuthUserPayload,
): Promise<EnterpriseJobListRecord[]> {
  return prisma.job.findMany({
    where: accessibleJobWhere(user),
    orderBy: { createdAt: "desc" },
    select: ENTERPRISE_JOB_LIST_SELECT,
  });
}

export async function findAccessibleJob(
  user: AuthUserPayload,
  jobId: string,
): Promise<EnterpriseJobRecord | null> {
  return prisma.job.findFirst({
    where: { id: jobId, ...accessibleJobWhere(user) },
    include: ENTERPRISE_JOB_INCLUDE,
  });
}

export async function findAccessibleApplication(
  user: AuthUserPayload,
  applicationId: string,
): Promise<EnterpriseApplicationRecord | null> {
  return prisma.application.findFirst({
    where: { id: applicationId, ...accessibleApplicationWhere(user) },
    include: ENTERPRISE_APPLICATION_INCLUDE,
  });
}

export async function findAccessibleOffer(user: AuthUserPayload, offerId: string) {
  return prisma.offer.findFirst({
    where: { id: offerId, application: accessibleApplicationWhere(user) },
    select: { id: true, applicationId: true, companyId: true },
  });
}
