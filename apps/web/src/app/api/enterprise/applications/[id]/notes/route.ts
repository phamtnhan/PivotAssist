import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  findAccessibleApplication,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z.object({ body: z.string().trim().min(1).max(10000) }).strict();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    if (!(await findAccessibleApplication(user, id)))
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    const notes = await prisma.applicationNote.findMany({
      where: { applicationId: id },
      include: { author: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error("[Application Notes GET]", error);
    return errorResponse("Không thể tải ghi chú hồ sơ.", 503);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Nội dung ghi chú không hợp lệ.", 400);
  const { id } = await context.params;
  try {
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "pipeline:write", application.job.company.id)))
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    const note = await prisma.applicationNote.create({
      data: { applicationId: id, authorId: user.userId, body: parsed.data.body },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    });
    await writeAuditLog(user, "application.note_created", id);
    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error) {
    console.error("[Application Notes POST]", error);
    return errorResponse("Không thể lưu ghi chú hồ sơ.", 503);
  }
}
