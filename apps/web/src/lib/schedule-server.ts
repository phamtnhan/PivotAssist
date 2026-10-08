import { prisma } from "@/lib/auth";

const SLOT_DURATION_MS = 60 * 60 * 1000;

export async function findScheduleConflict(input: {
  applicationId: string;
  candidateUserId: string;
  companyId: string;
  scheduledAt: Date;
  interviewerName?: string | null;
  excludeScheduleId?: string;
}) {
  const slotEnd = new Date(input.scheduledAt.getTime() + SLOT_DURATION_MS);
  const slotStart = new Date(input.scheduledAt.getTime() - SLOT_DURATION_MS);
  const conflict = await prisma.faceToFaceSchedule.findFirst({
    where: {
      status: "SCHEDULED",
      id: input.excludeScheduleId ? { not: input.excludeScheduleId } : undefined,
      scheduledAt: { gte: slotStart, lt: slotEnd },
      OR: [
        { applicationId: input.applicationId },
        { application: { userId: input.candidateUserId } },
        ...(input.interviewerName?.trim()
          ? [
              {
                interviewerName: input.interviewerName.trim(),
                application: { job: { companyId: input.companyId } },
              },
            ]
          : []),
      ],
    },
    select: { id: true, applicationId: true, scheduledAt: true, interviewerName: true },
  });
  return conflict;
}
