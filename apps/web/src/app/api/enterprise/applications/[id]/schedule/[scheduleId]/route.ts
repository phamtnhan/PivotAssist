import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  findAccessibleApplication,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";
import { findScheduleConflict } from "@/lib/schedule-server";

const Schema = z
  .object({
    scheduledAt: z.string().datetime().optional(),
    timezone: z.string().trim().max(80).optional(),
    interviewerName: z.string().trim().max(160).nullable().optional(),
    meetingUrl: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      z.string().url().nullable().optional(),
    ),
    notes: z.string().max(5000).nullable().optional(),
    status: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]).optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Thông tin lịch không hợp lệ.", 400);
  const { id, scheduleId } = await context.params;
  try {
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "pipeline:write", application.job.company.id)))
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    const existing = await prisma.faceToFaceSchedule.findFirst({
      where: { id: scheduleId, applicationId: id },
      select: { id: true, scheduledAt: true, status: true },
    });
    if (!existing) return errorResponse("Lịch không tồn tại.", 404);
    const nextStatus = parsed.data.status ?? existing.status;
    if (nextStatus === "SCHEDULED") {
      const nextAt = parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : existing.scheduledAt;
      if (Number.isNaN(nextAt.getTime()) || nextAt.getTime() <= Date.now())
        return errorResponse(
          "Thời gian phòng phỏng vấn phải ở tương lai.",
          400,
          "SCHEDULE_TIME_INVALID",
        );
      const conflict = await findScheduleConflict({
        applicationId: id,
        candidateUserId: application.user.id,
        companyId: application.job.company.id,
        scheduledAt: nextAt,
        interviewerName: parsed.data.interviewerName,
        excludeScheduleId: scheduleId,
      });
      if (conflict)
        return errorResponse(
          "Ứng viên hoặc người phỏng vấn đã có lịch trùng trong khoảng thời gian này.",
          409,
          "SCHEDULE_CONFLICT",
        );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const schedule = await tx.faceToFaceSchedule.update({
        where: { id: scheduleId },
        data: {
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
          timezone: parsed.data.timezone,
          interviewerName: parsed.data.interviewerName,
          meetingUrl: parsed.data.meetingUrl,
          notes: parsed.data.notes,
          status: parsed.data.status,
        },
      });
      if (nextStatus === "CANCELLED") {
        const remaining = await tx.faceToFaceSchedule.findFirst({
          where: { applicationId: id, status: "SCHEDULED", id: { not: scheduleId } },
          orderBy: { scheduledAt: "desc" },
        });
        await tx.application.update({
          where: { id },
          data: remaining
            ? { status: "FACE_TO_FACE_SCHEDULED", faceToFaceScheduledAt: remaining.scheduledAt }
            : { status: "SHORTLISTED", faceToFaceScheduledAt: null },
        });
      } else if (nextStatus === "COMPLETED") {
        await tx.application.update({
          where: { id },
          data: { status: "SHORTLISTED", faceToFaceScheduledAt: null },
        });
      } else {
        await tx.application.update({
          where: { id },
          data: { faceToFaceScheduledAt: schedule.scheduledAt, status: "FACE_TO_FACE_SCHEDULED" },
        });
      }
      return schedule;
    });
    await writeAuditLog(user, "application.schedule_updated", id, {
      scheduleId,
      status: parsed.data.status,
    });
    const { publishPipelineChanged } = await import("@/lib/realtime-hub");
    publishPipelineChanged();
    return NextResponse.json({ success: true, schedule: updated });
  } catch (error) {
    console.error("[Schedule PATCH]", error);
    return errorResponse("Không thể cập nhật lịch phòng phỏng vấn.", 503);
  }
}
