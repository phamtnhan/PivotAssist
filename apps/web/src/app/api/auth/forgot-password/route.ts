import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/auth";
import {
  createPasswordResetSecret,
  deliverPasswordReset,
  passwordResetUrl,
} from "@/lib/password-reset";
import { errorResponse } from "@/lib/server-utils";
import { disallowedOriginResponse } from "@/lib/request-origin";

const Schema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Email không hợp lệ.", 400);
  const email = parsed.data.email.toLowerCase().trim();
  const genericMessage = "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.";
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });
    if (!user || !user.isActive)
      return NextResponse.json({ success: true, accepted: true, message: genericMessage });

    const secret = createPasswordResetSecret();
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: secret.tokenHash, expiresAt: secret.expiresAt },
      }),
    ]);

    const delivery = await deliverPasswordReset({
      email: user.email,
      resetUrl: passwordResetUrl(secret.secret),
    });
    if (delivery.mode === "unavailable") {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash: secret.tokenHash } });
      return errorResponse(
        "Dịch vụ email khôi phục chưa được cấu hình.",
        503,
        "PASSWORD_RESET_DELIVERY_UNAVAILABLE",
      );
    }
    return NextResponse.json({
      success: true,
      accepted: true,
      message:
        delivery.mode === "local"
          ? "Đã tạo liên kết khôi phục local. Liên kết hết hạn sau một giờ."
          : genericMessage,
      ...(delivery.mode === "local" ? { resetUrl: delivery.resetUrl } : {}),
    });
  } catch (error) {
    console.error("[Forgot Password]", error instanceof Error ? error.message : error);
    return errorResponse("Không thể tạo yêu cầu khôi phục mật khẩu.", 503, "PASSWORD_RESET_FAILED");
  }
}
