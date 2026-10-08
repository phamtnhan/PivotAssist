import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  findAccessibleApplication,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { createNotification, errorResponse, writeAuditLog } from "@/lib/server-utils";
import { findScheduleConflict } from "@/lib/schedule-server";

const Schema = z
  .object({
    scheduledAt: z.string().datetime(),
    timezone: z.string().trim().min(1).max(80).default("Asia/Ho_Chi_Minh"),
    interviewerName: z.string().trim().max(160).nullable().optional(),
    meetingUrl: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      z.string().url().nullable().optional(),
    ),
    notes: z.string().max(5000).nullable().optional(),
  })
  .strict();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    if (!(await findAccessibleApplication(user, id)))
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    const schedules = await prisma.faceToFaceSchedule.findMany({
      where: { applicationId: id },
      orderBy: { scheduledAt: "asc" },
    });
    return NextResponse.json({ success: true, schedules });
  } catch (error) {
    console.error("[Schedule GET]", error);
    return errorResponse("Không thể tải lịch phòng phỏng vấn.", 503);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Thông tin lịch không hợp lệ.", 400);
  const { id } = await context.params;
  try {
    const scheduledDate = new Date(parsed.data.scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      return errorResponse("Thời gian phỏng vấn phải ở tương lai.", 400);
    }
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "pipeline:write", application.job.company.id)))
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    if (!["SHORTLISTED", "FACE_TO_FACE_SCHEDULED"].includes(application.status))
      return errorResponse("Hồ sơ phải được chọn sơ loại trước khi đặt lịch.", 409);
    const conflict = await findScheduleConflict({
      applicationId: id,
      candidateUserId: application.user.id,
      companyId: application.job.company.id,
      scheduledAt: scheduledDate,
      interviewerName: parsed.data.interviewerName,
    });
    if (conflict)
      return errorResponse(
        "Ứng viên hoặc người phỏng vấn đã có lịch trùng trong khoảng thời gian này.",
        409,
        "SCHEDULE_CONFLICT",
      );
    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.faceToFaceSchedule.create({
        data: {
          applicationId: id,
          scheduledAt: new Date(parsed.data.scheduledAt),
          timezone: parsed.data.timezone,
          interviewerName: parsed.data.interviewerName,
          meetingUrl: parsed.data.meetingUrl,
          notes: parsed.data.notes,
          createdById: user.userId,
        },
      });
      await tx.application.update({
        where: { id },
        data: {
          status: "FACE_TO_FACE_SCHEDULED",
          faceToFaceScheduledAt: new Date(parsed.data.scheduledAt),
        },
      });
      return created;
    });
    await createNotification({
      userId: application.user.id,
      type: "FACE_TO_FACE_SCHEDULED",
      title: "Bạn đã được mời vào phòng phỏng vấn",
      body: `Lịch ${application.job.title}: ${new Date(parsed.data.scheduledAt).toLocaleString("vi-VN")}${parsed.data.interviewerName ? ` · ${parsed.data.interviewerName}` : ""}.`,
      href: `/face-to-face/${schedule.id}`,
    });
    await writeAuditLog(user, "application.schedule_created", id, { scheduleId: schedule.id });
    const { publishPipelineChanged } = await import("@/lib/realtime-hub");
    publishPipelineChanged();
    return NextResponse.json({ success: true, schedule }, { status: 201 });
  } catch (error) {
    console.error("[Schedule POST]", error);
    return errorResponse("Không thể tạo phòng phỏng vấn.", 503);
  }
}
