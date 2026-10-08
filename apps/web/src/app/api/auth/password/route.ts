import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  comparePassword,
  createSessionToken,
  getCurrentUser,
  hashPassword,
  prisma,
} from "@/lib/auth";
import { attachSessionCookie } from "@/lib/auth-session";
import { asPreferences, toInputJsonValue } from "@/lib/user-preferences";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(128),
  })
  .strict();

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để đổi mật khẩu.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Mật khẩu mới chưa hợp lệ.", 400);
  try {
    const account = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { passwordHash: true, preferencesJson: true },
    });
    if (
      !account?.passwordHash ||
      !(await comparePassword(parsed.data.currentPassword, account.passwordHash))
    ) {
      return errorResponse("Mật khẩu hiện tại không đúng.", 400);
    }
    const now = Date.now();
    const prefs = asPreferences(account.preferencesJson);
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        preferencesJson: toInputJsonValue({ ...prefs, passwordChangedAt: now }),
      },
    });
    await writeAuditLog(user, "auth.password_changed", user.userId);
    const response = NextResponse.json({ success: true, message: "Đã cập nhật mật khẩu." });
    const freshToken = await createSessionToken({
      userId: user.userId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
    return attachSessionCookie(response, freshToken);
  } catch (error) {
    console.error("[Password POST]", error);
    return errorResponse("Không thể cập nhật mật khẩu.", 503);
  }
}
