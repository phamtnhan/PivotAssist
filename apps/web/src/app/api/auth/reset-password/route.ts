import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, prisma } from "@/lib/auth";
import { hashPasswordResetSecret } from "@/lib/password-reset";
import { toInputJsonValue } from "@/lib/user-preferences";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z
  .object({ token: z.string().trim().min(40).max(128), newPassword: z.string().min(6).max(128) })
  .strict();

export async function POST(request: NextRequest) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse("Liên kết hoặc mật khẩu mới không hợp lệ.", 400, "PASSWORD_RESET_INVALID");
  const tokenHash = hashPasswordResetSecret(parsed.data.token);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findFirst({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, userId: true },
      });
      if (!token) throw new Error("PASSWORD_RESET_TOKEN_INVALID");
      const user = await tx.user.findUnique({
        where: { id: token.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          preferencesJson: true,
          isActive: true,
        },
      });
      if (!user || !user.isActive) throw new Error("PASSWORD_RESET_TOKEN_INVALID");
      const currentPreferences =
        user.preferencesJson &&
        typeof user.preferencesJson === "object" &&
        !Array.isArray(user.preferencesJson)
          ? (user.preferencesJson as Record<string, unknown>)
          : {};
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(parsed.data.newPassword),
          preferencesJson: toInputJsonValue({
            ...currentPreferences,
            passwordChangedAt: Date.now(),
          }),
        },
      });
      await tx.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
    });
    await writeAuditLog(
      { userId: result.id, email: result.email, fullName: result.fullName, role: result.role },
      "auth.password_reset",
      result.id,
    );
    return NextResponse.json({
      success: true,
      message: "Mật khẩu đã được đặt lại. Bạn có thể đăng nhập.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PASSWORD_RESET_TOKEN_INVALID")
      return errorResponse(
        "Liên kết khôi phục không hợp lệ hoặc đã hết hạn.",
        400,
        "PASSWORD_RESET_TOKEN_INVALID",
      );
    console.error("[Reset Password]", error instanceof Error ? error.message : error);
    return errorResponse("Không thể đặt lại mật khẩu.", 503, "PASSWORD_RESET_FAILED");
  }
}
