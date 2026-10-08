import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { decryptSecret, encryptSecret, verifyTotp } from "@/lib/totp";
import { asPreferences } from "@/lib/user-preferences";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z.object({ code: z.string().min(6).max(8) }).strict();

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xác nhận xác thực hai bước.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Mã TOTP không hợp lệ.", 400);

  const account = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { preferencesJson: true },
  });
  if (!account) return errorResponse("Tài khoản không tồn tại.", 404);
  const prefs = asPreferences(account.preferencesJson);
  const pending =
    typeof prefs.totpSecretPending === "string" ? decryptSecret(prefs.totpSecretPending) : null;
  if (!pending)
    return errorResponse(
      "Chưa bắt đầu bước thiết lập. Hãy thiết lập xác thực hai bước trước.",
      409,
    );
  if (!verifyTotp(pending, parsed.data.code))
    return errorResponse("Mã TOTP không đúng. Thử mã hiện tại trên ứng dụng authenticator.", 401);

  const { totpSecretPending: _pending, ...rest } = prefs;
  await prisma.user.update({
    where: { id: user.userId },
    data: {
      preferencesJson: {
        ...rest,
        totpSecretEncrypted: encryptSecret(pending),
        twoFactorEnabled: true,
      },
    },
  });
  await writeAuditLog(user, "auth.2fa.enabled", user.userId);
  return NextResponse.json({
    success: true,
    twoFactorEnabled: true,
    message: "Đã bật TOTP. Lần đăng nhập sau sẽ yêu cầu mã 6 số.",
  });
}
