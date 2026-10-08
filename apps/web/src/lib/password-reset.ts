import { createHash, randomBytes } from "node:crypto";

const RESET_TTL_MS = 60 * 60 * 1000;

export function createPasswordResetSecret() {
  const secret = randomBytes(32).toString("hex");
  return {
    secret,
    tokenHash: hashPasswordResetSecret(secret),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  };
}

export function hashPasswordResetSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function passwordResetUrl(secret: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(secret)}`;
}

export async function deliverPasswordReset(input: { email: string; resetUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: "Đặt lại mật khẩu PivotAssist",
        text: `Mở liên kết sau trong vòng một giờ để đặt lại mật khẩu: ${input.resetUrl}`,
        html: `<p>Bạn đã yêu cầu đặt lại mật khẩu PivotAssist.</p><p><a href="${input.resetUrl}">Đặt lại mật khẩu</a></p><p>Liên kết hết hạn sau một giờ.</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Password reset email failed with HTTP ${response.status}`);
    return { mode: "resend" as const };
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[PasswordReset] Local reset link for ${input.email}: ${input.resetUrl}`);
    return { mode: "local" as const, resetUrl: input.resetUrl };
  }
  return { mode: "unavailable" as const };
}
