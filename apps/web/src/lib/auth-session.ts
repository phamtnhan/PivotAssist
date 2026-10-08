import { NextResponse } from "next/server";
import {
  prisma,
  comparePassword,
  createSessionToken,
  createTwoFactorPendingToken,
} from "@/lib/auth";
import { isTwoFactorEnabled } from "@/lib/user-preferences";
import { sessionCookieSetOptions } from "@/lib/session-cookie";

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(sessionCookieSetOptions(token));
  return response;
}

export async function issueSession(
  user: { id: string; email: string; fullName: string; role: "CANDIDATE" | "RECRUITER" | "ADMIN" },
  message = "Đăng nhập thành công!",
) {
  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
  const response = NextResponse.json({
    success: true,
    message,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
  return attachSessionCookie(response, token);
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
}

export async function verifyUserPassword(
  user: { passwordHash: string | null; isActive: boolean },
  password: string,
) {
  const generic = "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.";
  if (!user.passwordHash) return { ok: false as const, status: 401, message: generic };
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid || !user.isActive) return { ok: false as const, status: 401, message: generic };
  return { ok: true as const };
}

export function userRequiresTwoFactor(preferencesJson: unknown) {
  return isTwoFactorEnabled(preferencesJson);
}

export async function pendingTwoFactorResponse(userId: string) {
  const pendingToken = await createTwoFactorPendingToken(userId);
  return NextResponse.json({
    success: true,
    requiresTwoFactor: true,
    pendingToken,
    message: "Nhập mã xác thực 6 số từ Google Authenticator hoặc ứng dụng TOTP.",
  });
}
