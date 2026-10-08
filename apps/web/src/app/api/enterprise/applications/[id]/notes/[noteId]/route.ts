import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  findAccessibleApplication,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id, noteId } = await context.params;
  try {
    const application = await findAccessibleApplication(user, id);
    if (!application)
      return errorResponse("Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "pipeline:write", application.job.company.id)))
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    const deleted = await prisma.applicationNote.deleteMany({
      where: {
        id: noteId,
        applicationId: id,
        ...(user.role === "ADMIN" ? {} : { authorId: user.userId }),
      },
    });
    if (deleted.count === 0)
      return errorResponse("Ghi chú không tồn tại hoặc bạn không có quyền xóa.", 404);
    await writeAuditLog(user, "application.note_deleted", id, { noteId });
    return NextResponse.json({ success: true, deletedId: noteId });
  } catch (error) {
    console.error("[Application Note DELETE]", error);
    return errorResponse("Không thể xóa ghi chú hồ sơ.", 503);
  }
}
