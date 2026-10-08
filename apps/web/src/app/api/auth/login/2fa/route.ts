import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, verifyTwoFactorPendingToken } from "@/lib/auth";
import { issueSession } from "@/lib/auth-session";
import { decryptSecret, verifyTotp } from "@/lib/totp";
import { consumeKeyedLimit } from "@/lib/keyed-limit";
import { asPreferences, isTwoFactorEnabled } from "@/lib/user-preferences";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";
import { disallowedOriginResponse } from "@/lib/request-origin";

// REQ-0033 — 2FA completion/failure writes AuditLog

const Schema = z
  .object({
    pendingToken: z.string().min(10),
    code: z.string().min(6).max(8),
  })
  .strict();

export async function POST(request: NextRequest) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Mã xác thực không hợp lệ.", 400);
  const throttle = await consumeKeyedLimit(
    "login-2fa",
    parsed.data.pendingToken.slice(0, 24),
    8,
    15 * 60_000,
  );
  if (!throttle.ok) return errorResponse("Quá nhiều lần nhập mã 2FA. Vui lòng thử lại sau.", 429);
  const userId = await verifyTwoFactorPendingToken(parsed.data.pendingToken);
  if (!userId) {
    void writeAuditLog(null, "auth.login.2fa.failed", "login");
    return errorResponse("Phiên xác thực hai bước đã hết hạn. Hãy đăng nhập lại.", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    void writeAuditLog(null, "auth.login.2fa.failed", userId);
    return errorResponse("Phiên xác thực hai bước đã hết hạn. Hãy đăng nhập lại.", 401);
  }
  if (!isTwoFactorEnabled(user.preferencesJson))
    return errorResponse("Tài khoản chưa bật TOTP.", 409);

  const secret = decryptSecret(String(asPreferences(user.preferencesJson).totpSecretEncrypted));
  if (!secret || !verifyTotp(secret, parsed.data.code)) {
    void writeAuditLog(
      { userId: user.id, email: user.email, fullName: user.fullName, role: user.role },
      "auth.login.2fa.failed",
      user.id,
    );
    return errorResponse("Mã TOTP không đúng hoặc đã hết hạn.", 401);
  }

  void writeAuditLog(
    { userId: user.id, email: user.email, fullName: user.fullName, role: user.role },
    "auth.login.success",
    user.id,
  );
  return issueSession(user, "Đăng nhập thành công với 2FA.");
}
