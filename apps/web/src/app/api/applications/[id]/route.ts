import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { toCandidateApplicationDto } from "@/lib/candidate-application-view";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const PatchSchema = z.object({ status: z.literal("WITHDRAWN") }).strict();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem hồ sơ đã nộp.", 401);
  const { id } = await context.params;
  try {
    const application = await prisma.application.findFirst({
      where: { id, userId: user.userId },
      include: {
        job: {
          select: { id: true, title: true, location: true, company: { select: { name: true } } },
        },
        resume: { select: { id: true, fileAsset: { select: { filename: true } } } },
        interviews: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, createdAt: true, endedAt: true, roundIndex: true },
        },
        schedules: { orderBy: { scheduledAt: "asc" } },
        offers: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!application) return errorResponse("Hồ sơ không tồn tại.", 404);
    return NextResponse.json({
      success: true,
      application: toCandidateApplicationDto(application),
    });
  } catch (error) {
    console.error("[Application GET]", error);
    return errorResponse("Không thể tải hồ sơ đã nộp.", 503);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để cập nhật hồ sơ đã nộp.", 401);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Trạng thái hồ sơ không hợp lệ.", 400);
  const { id } = await context.params;
  try {
    const application = await prisma.application.findFirst({
      where: { id, userId: user.userId },
      select: { id: true, status: true },
    });
    if (!application) return errorResponse("Hồ sơ không tồn tại.", 404);
    if (["HIRED", "REJECTED", "WITHDRAWN"].includes(application.status))
      return errorResponse("Hồ sơ đã đóng và không thể rút lại.", 409);
    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.application.update({
        where: { id },
        data: { status: parsed.data.status, withdrawnAt: new Date() },
      });
      await tx.offer.updateMany({
        where: { applicationId: id, status: { in: ["SENT", "APPROVAL_PENDING"] } },
        data: { status: "WITHDRAWN" },
      });
      return app;
    });
    await writeAuditLog(user, "application.withdrawn", id);
    return NextResponse.json({ success: true, application: updated });
  } catch (error) {
    console.error("[Application PATCH]", error);
    return errorResponse("Không thể rút hồ sơ đã nộp.", 503);
  }
}
