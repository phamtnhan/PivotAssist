import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getSessionUser, prisma } from "@/lib/auth";
import {
  createNotification,
  errorResponse,
  paginationFromRequest,
  writeAuditLog,
} from "@/lib/server-utils";
import { persistJobMatch } from "@/lib/job-match-server";
import { isGarbageOrgName } from "@/lib/org-name";
import { toCandidateApplicationDto } from "@/lib/candidate-application-view";
import { parsePipelineStatus, reapplyPolicy } from "@/lib/hiring-pipeline";

const CreateApplicationSchema = z.object({
  jobId: z.string().min(1, "Việc làm là bắt buộc"),
  resumeId: z.string().min(1).optional(),
});

function serializeApplication(application: {
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
}) {
  return {
    ...application,
    appliedAt: application.appliedAt?.toISOString(),
    shortlistedAt: application.shortlistedAt?.toISOString(),
    faceToFaceScheduledAt: application.faceToFaceScheduledAt?.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem hồ sơ đã nộp.", 401);

  try {
    const { page, pageSize, skip } = paginationFromRequest(request, { pageSize: 30 });
    const where = { userId: user.userId };
    const visibilityRows = await prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true, job: { select: { company: { select: { name: true } } } } },
    });
    const visibleIds = visibilityRows
      .filter((row) => !isGarbageOrgName(row.job.company.name))
      .map((row) => row.id);
    const pageIds = visibleIds.slice(skip, skip + pageSize);
    const applications =
      pageIds.length === 0
        ? []
        : await prisma.application.findMany({
            where: { id: { in: pageIds } },
            include: {
              job: {
                select: {
                  id: true,
                  title: true,
                  location: true,
                  company: { select: { name: true } },
                },
              },
              resume: { select: { id: true, fileAsset: { select: { filename: true } } } },
              interviews: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  endedAt: true,
                  roundIndex: true,
                },
              },
              schedules: {
                orderBy: { scheduledAt: "asc" },
                select: {
                  id: true,
                  scheduledAt: true,
                  interviewerName: true,
                  meetingUrl: true,
                  timezone: true,
                  status: true,
                },
              },
              offers: { orderBy: { createdAt: "desc" } },
            },
          });
    const position = new Map(pageIds.map((id, index) => [id, index]));
    applications.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
    const visible = applications.map(toCandidateApplicationDto);
    const total = visibleIds.length;
    return NextResponse.json(
      {
        success: true,
        applications: visible,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Applications GET] Database error:", error?.message);
    return errorResponse("Không thể tải danh sách hồ sơ đã nộp.", 503);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để nộp hồ sơ.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ tài khoản ứng viên mới có thể nộp hồ sơ.", 403);

  const parseResult = CreateApplicationSchema.safeParse(await req.json().catch(() => null));
  if (!parseResult.success) {
    return errorResponse(
      parseResult.error.errors[0]?.message ?? "Dữ liệu hồ sơ không hợp lệ.",
      400,
    );
  }

  const { jobId, resumeId } = parseResult.data;

  try {
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        isPublished: true,
        archivedAt: null,
        company: { verificationStatus: "VERIFIED" },
      },
      select: { id: true, company: { select: { name: true } } },
    });
    if (!job) return errorResponse("Việc làm không tồn tại hoặc đã đóng.", 404);
    if (isGarbageOrgName(job.company.name))
      return errorResponse("Việc làm này không còn hiển thị công khai.", 404);

    let selectedResumeId = resumeId;
    if (resumeId) {
      const resume = await prisma.resume.findFirst({
        where: { id: resumeId, userId: user.userId },
        select: { id: true },
      });
      if (!resume) return errorResponse("CV không thuộc tài khoản hiện tại.", 400);
    } else {
      const activeResume = await prisma.resume.findFirst({
        where: { userId: user.userId, isActive: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      selectedResumeId = activeResume?.id;
    }
    if (!selectedResumeId)
      return errorResponse("Bạn cần tải CV trước khi nộp hồ sơ.", 409, "RESUME_REQUIRED");

    const existing = await prisma.application.findUnique({
      where: { userId_jobId: { userId: user.userId, jobId } },
      select: { id: true, status: true, resumeId: true, interviews: { select: { id: true } } },
    });
    const policy = existing ? reapplyPolicy(parsePipelineStatus(existing.status)) : "reopen";
    if (policy === "reject") {
      return errorResponse("Hồ sơ này đã đóng và không thể nộp lại.", 409, "APPLICATION_CLOSED");
    }
    if (
      existing &&
      policy === "keep" &&
      existing.interviews.length > 0 &&
      existing.resumeId !== selectedResumeId
    ) {
      return errorResponse(
        "CV đã nộp không thể thay đổi sau khi hồ sơ đã có dữ liệu phỏng vấn. Hãy dùng CV cũ hoặc tạo vòng ứng tuyển mới.",
        409,
        "RESUME_CHANGE_REQUIRES_NEW_ROUND",
      );
    }

    const application = await prisma.application.upsert({
      where: { userId_jobId: { userId: user.userId, jobId } },
      create: {
        userId: user.userId,
        jobId,
        resumeId: selectedResumeId ?? null,
        status: "AI_INTERVIEW_PENDING",
        appliedAt: new Date(),
      },
      update:
        policy === "reopen"
          ? {
              resumeId: selectedResumeId ?? undefined,
              appliedAt: new Date(),
              status: "AI_INTERVIEW_PENDING",
              withdrawnAt: null,
            }
          : {
              resumeId: selectedResumeId ?? undefined,
            },
    });

    const { publishPipelineChanged, publishToUser } = await import("@/lib/realtime-hub");
    publishToUser(user.userId, "notification");
    publishPipelineChanged();
    if (!existing || policy === "reopen") {
      await createNotification({
        userId: user.userId,
        type: "APPLICATION_CREATED",
        title: "Đã nộp hồ sơ",
        body: "Bước tiếp theo là hoàn tất vòng phỏng vấn AI cho vị trí này.",
        href: "/applications",
      });
    }
    await writeAuditLog(
      user,
      existing && policy === "keep" ? "application.updated" : "application.created",
      application.id,
      { jobId, resumeId: selectedResumeId },
    );
    void persistJobMatch({ userId: user.userId, jobId, resumeId: selectedResumeId }).catch(
      () => null,
    );

    return NextResponse.json(
      { success: true, application: serializeApplication(application) },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[Applications POST] Database error:", error?.message);
    return errorResponse("Không thể nộp hồ sơ. Vui lòng thử lại.", 503);
  }
}
