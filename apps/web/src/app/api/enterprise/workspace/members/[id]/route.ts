import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { hasEnterpriseCapability, isEnterpriseUser } from "@/lib/enterprise-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const member = await prisma.companyMember.findUnique({
      where: { id },
      select: { id: true, companyId: true, userId: true, role: true },
    });
    if (!member) return errorResponse("Thành viên không tồn tại.", 404);
    if (!(await hasEnterpriseCapability(user, "members:write", member.companyId)))
      return errorResponse("Bạn không có quyền xóa thành viên.", 403);
    if (user.role !== "ADMIN") {
      const own = await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: member.companyId, userId: user.userId } },
        select: { role: true },
      });
      if (!own || !["OWNER", "ADMIN"].includes(own.role))
        return errorResponse("Bạn không có quyền xóa thành viên.", 403);
    }
    if (member.role === "OWNER")
      return errorResponse("Không thể xóa chủ sở hữu cuối cùng của công ty.", 409);
    await prisma.companyMember.delete({ where: { id } });
    await writeAuditLog(user, "workspace.member_removed", id);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("[Workspace Member DELETE]", error);
    return errorResponse("Không thể xóa thành viên công ty.", 503);
  }
}
