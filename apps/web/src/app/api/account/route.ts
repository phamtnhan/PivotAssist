import { NextResponse } from "next/server";
import { getCurrentUser, prisma, SESSION_COOKIE_NAME } from "@/lib/auth";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";
import { deleteLocalFile } from "@/lib/local-file-storage";

export async function DELETE(request: Request) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xóa tài khoản.", 401);
  try {
    const assets = await prisma.fileAsset.findMany({
      where: { userId: user.userId },
      select: { fileKey: true },
    });
    await prisma.user.delete({ where: { id: user.userId } });
    const fileCleanup = await Promise.allSettled(
      assets.map((asset) => deleteLocalFile(asset.fileKey)),
    );
    const cleanupFailures = fileCleanup.filter((result) => result.status === "rejected");
    if (cleanupFailures.length > 0)
      console.error("[Account DELETE] Local asset cleanup incomplete", {
        userId: user.userId,
        failures: cleanupFailures.length,
      });
    await writeAuditLog(null, "account.deleted", user.userId).catch((auditError) =>
      console.error("[Account DELETE] Audit log failed", auditError),
    );
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      expires: new Date(0),
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("[Account DELETE]", error);
    return errorResponse("Không thể xóa tài khoản.", 503);
  }
}
