import { prisma } from "@/lib/auth";
import type { AuthUserPayload } from "@/lib/auth";
import { isEnterpriseUser } from "@/lib/enterprise-server";
import { parseResumeText } from "@pivotassist/free-ai";

export const scheduleInclude = {
  application: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          profile: {
            select: {
              currentJobTitle: true,
              targetJobTitle: true,
              yearsOfExperience: true,
              phone: true,
              location: true,
            },
          },
        },
      },
      job: { include: { company: { include: { members: { select: { userId: true } } } } } },
      resume: {
        select: {
          id: true,
          parsedText: true,
          fileAsset: {
            select: { filename: true, mimeType: true, fileKey: true },
          },
        },
      },
      interviews: {
        where: { status: "COMPLETED" as const },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          targetRole: true,
          interviewScore: {
            select: {
              overallScore: true,
              technicalScore: true,
              starOverallScore: true,
              strengthsJson: true,
              improvementsJson: true,
              recommendation: true,
              summaryText: true,
            },
          },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" as const },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { fullName: true } },
        },
      },
    },
  },
} as const;

export type FaceToFaceScheduleRecord = Awaited<
  ReturnType<typeof prisma.faceToFaceSchedule.findFirst<{ include: typeof scheduleInclude }>>
>;

export function faceToFaceRoomHref(scheduleId: string): string {
  return `/face-to-face/${scheduleId}`;
}

export function liveKitRoomNameForSchedule(scheduleId: string): string {
  return `f2f_${scheduleId}`;
}

export async function findAccessibleSchedule(user: AuthUserPayload, scheduleId: string) {
  const schedule = await prisma.faceToFaceSchedule.findUnique({
    where: { id: scheduleId },
    include: scheduleInclude,
  });
  if (!schedule) return null;
  if (user.role === "CANDIDATE" && schedule.application.userId === user.userId) return schedule;
  if (!isEnterpriseUser(user)) return null;
  if (user.role === "ADMIN") return schedule;
  if (schedule.createdById === user.userId) return schedule;
  const member = schedule.application.job.company.members.some(
    (item) => item.userId === user.userId,
  );
  if (member) return schedule;
  if (user.role === "RECRUITER") return schedule;
  return null;
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === "string");
}

export type SerializableScheduleInput = {
  id: string;
  applicationId: string;
  scheduledAt: Date;
  timezone: string;
  interviewerName: string | null;
  meetingUrl: string | null;
  status: string;
  notes: string | null;
  application: {
    job: { title: string; company: { name: string } };
    user: {
      id: string;
      fullName: string;
      email: string;
      avatarUrl?: string | null;
      profile?: {
        currentJobTitle?: string | null;
        targetJobTitle?: string | null;
        yearsOfExperience?: number;
        phone?: string | null;
        location?: string | null;
      } | null;
    };
    resume?: {
      id?: string;
      parsedText?: string | null;
      fileAsset?: {
        filename?: string | null;
        mimeType?: string | null;
        fileKey?: string | null;
      } | null;
    } | null;
    interviews?: Array<{
      id: string;
      createdAt: Date;
      targetRole?: string;
      interviewScore?: {
        overallScore?: number;
        technicalScore?: number;
        starOverallScore?: number;
        recommendation?: string | null;
        summaryText?: string | null;
        strengthsJson?: unknown;
        improvementsJson?: unknown;
      } | null;
    }>;
    notes?: Array<{
      id: string;
      body: string;
      createdAt: Date;
      author: { fullName: string };
    }>;
  };
};

export function serializeSchedule(schedule: SerializableScheduleInput, isInterviewer = false) {
  const latestInterview = schedule.application.interviews?.[0] ?? null;
  const parsedCv = schedule.application.resume?.parsedText
    ? parseResumeText(
        schedule.application.resume.parsedText,
        schedule.application.resume.fileAsset?.filename ?? "resume.pdf",
      )
    : null;

  const candidateDossier = isInterviewer
    ? {
        candidate: {
          id: schedule.application.user.id,
          fullName: schedule.application.user.fullName,
          email: schedule.application.user.email,
          avatarUrl: schedule.application.user.avatarUrl ?? null,
          phone: schedule.application.user.profile?.phone ?? parsedCv?.phone ?? null,
          location: schedule.application.user.profile?.location ?? parsedCv?.location ?? null,
          jobTitle:
            schedule.application.user.profile?.targetJobTitle ??
            schedule.application.user.profile?.currentJobTitle ??
            parsedCv?.currentJobTitle ??
            null,
          yearsOfExperience:
            schedule.application.user.profile?.yearsOfExperience ??
            parsedCv?.yearsOfExperience ??
            0,
        },
        resume: schedule.application.resume
          ? {
              fileName: schedule.application.resume.fileAsset?.filename ?? null,
              fileUrl: schedule.application.resume.id
                ? `/api/enterprise/applications/${schedule.applicationId}/resume`
                : null,
              parsedText: schedule.application.resume.parsedText ?? null,
              parsed: parsedCv,
            }
          : null,
        aiScreening: latestInterview?.interviewScore
          ? {
              sessionId: latestInterview.id,
              createdAt: latestInterview.createdAt.toISOString(),
              targetRole: latestInterview.targetRole ?? "",
              overallScore: latestInterview.interviewScore.overallScore ?? 80,
              technicalScore: latestInterview.interviewScore.technicalScore ?? 80,
              starOverallScore: latestInterview.interviewScore.starOverallScore ?? 80,
              recommendation: latestInterview.interviewScore.recommendation ?? null,
              summaryText: latestInterview.interviewScore.summaryText ?? null,
              strengths: asStringArray(latestInterview.interviewScore.strengthsJson),
              improvements: asStringArray(latestInterview.interviewScore.improvementsJson),
            }
          : null,
        notes: (schedule.application.notes ?? []).map((note) => ({
          id: note.id,
          body: note.body,
          authorName: note.author.fullName,
          createdAt: note.createdAt.toISOString(),
        })),
      }
    : null;

  return {
    id: schedule.id,
    applicationId: schedule.applicationId,
    scheduledAt: schedule.scheduledAt.toISOString(),
    timezone: schedule.timezone,
    interviewerName: schedule.interviewerName,
    meetingUrl: schedule.meetingUrl,
    status: schedule.status,
    notes: schedule.notes,
    jobTitle: schedule.application.job.title,
    companyName: schedule.application.job.company.name,
    candidateName: schedule.application.user.fullName,
    candidateEmail: schedule.application.user.email,
    roomHref: faceToFaceRoomHref(schedule.id),
    externalMeetingUrl:
      schedule.meetingUrl &&
      /^https?:\/\//i.test(schedule.meetingUrl) &&
      !schedule.meetingUrl.includes("/face-to-face/")
        ? schedule.meetingUrl
        : null,
    candidateDossier,
  };
}
