import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xóa kỹ năng.", 401);
  const { id } = await context.params;
  try {
    const deleted = await prisma.userSkill.deleteMany({
      where: { userId: user.userId, skillId: id },
    });
    if (deleted.count === 0) return errorResponse("Kỹ năng không tồn tại.", 404);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("[Skill DELETE]", error);
    return errorResponse("Không thể xóa kỹ năng.", 503);
  }
}
