// REQ-0027 — Origin check on cookie-authenticated 2FA disable
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { comparePassword, getCurrentUser, prisma } from "@/lib/auth";
import { decryptSecret, verifyTotp } from "@/lib/totp";
import { asPreferences, isTwoFactorEnabled, toInputJsonValue } from "@/lib/user-preferences";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z
  .object({
    code: z.string().min(6).max(8),
    password: z.string().min(1),
  })
  .strict();

export async function POST(request: NextRequest) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để tắt xác thực hai bước.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse("Cần mật khẩu và mã xác thực để tắt xác thực hai bước.", 400);

  const account = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { passwordHash: true, preferencesJson: true },
  });
  if (!account?.passwordHash) return errorResponse("Tài khoản không tồn tại.", 404);
  const passwordOk = await comparePassword(parsed.data.password, account.passwordHash);
  if (!passwordOk) return errorResponse("Mật khẩu không đúng.", 401);
  if (!isTwoFactorEnabled(account.preferencesJson))
    return errorResponse("Xác thực hai bước chưa được bật.", 409);

  const secret = decryptSecret(String(asPreferences(account.preferencesJson).totpSecretEncrypted));
  if (!secret || !verifyTotp(secret, parsed.data.code))
    return errorResponse("Mã TOTP không đúng.", 401);

  const prefs = asPreferences(account.preferencesJson);
  delete prefs.totpSecretEncrypted;
  delete prefs.totpSecretPending;
  prefs.twoFactorEnabled = false;
  await prisma.user.update({
    where: { id: user.userId },
    data: { preferencesJson: toInputJsonValue(prefs) },
  });
  await writeAuditLog(user, "auth.2fa.disabled", user.userId);
  return NextResponse.json({
    success: true,
    twoFactorEnabled: false,
    message: "Đã tắt TOTP trên tài khoản.",
  });
}
