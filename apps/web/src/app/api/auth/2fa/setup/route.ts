import { NextResponse } from "next/server";
import { getCurrentUser, prisma } from "@/lib/auth";
import { encryptSecret, generateTotpSecret, otpauthUrl, qrImageUrl } from "@/lib/totp";
import { asPreferences, isTwoFactorEnabled } from "@/lib/user-preferences";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để bật xác thực hai bước.", 401);
  const account = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true, preferencesJson: true },
  });
  if (!account) return errorResponse("Tài khoản không tồn tại.", 404);
  if (isTwoFactorEnabled(account.preferencesJson)) {
    return errorResponse("Xác thực hai bước đã được bật. Hãy tắt trước khi thiết lập lại.", 409);
  }

  const secret = generateTotpSecret();
  const otpauth = otpauthUrl(account.email, secret);
  const current = asPreferences(account.preferencesJson);
  await prisma.user.update({
    where: { id: user.userId },
    data: {
      preferencesJson: {
        ...current,
        totpSecretPending: encryptSecret(secret),
        twoFactorEnabled: false,
      },
    },
  });
  await writeAuditLog(user, "auth.2fa.setup", user.userId);
  return NextResponse.json({
    success: true,
    secret,
    otpauthUrl: otpauth,
    qrUrl: await qrImageUrl(otpauth),
    message: "Quét QR bằng Google Authenticator rồi nhập mã 6 số để hoàn tất.",
  });
}
