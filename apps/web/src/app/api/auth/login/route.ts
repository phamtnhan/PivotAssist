// REQ-0020 — login throttle; REQ-0028 — no DB details in 503; REQ-0033 — login audit
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  findUserByEmail,
  issueSession,
  pendingTwoFactorResponse,
  userRequiresTwoFactor,
  verifyUserPassword,
} from "@/lib/auth-session";
import { consumeKeyedLimit } from "@/lib/keyed-limit";
import { jsonError, writeAuditLog } from "@/lib/server-utils";

const LoginSchema = z.object({
  email: z.string().email("Địa chỉ email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export async function POST(req: NextRequest) {
  try {
    const parseResult = LoginSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return jsonError(
        parseResult.error.errors[0]?.message || "Thông tin đăng nhập không hợp lệ",
        400,
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const throttle = await consumeKeyedLimit(
      "login",
      `${ip}|${parseResult.data.email.toLowerCase()}`,
      8,
      15 * 60_000,
    );
    if (!throttle.ok) {
      return jsonError("Quá nhiều lần đăng nhập. Vui lòng thử lại sau.", 429, {
        retryAfterSec: throttle.retryAfterSec,
      });
    }

    let user;
    try {
      user = await findUserByEmail(parseResult.data.email);
    } catch (dbErr: unknown) {
      console.error(
        "[Auth Login] Database connection error:",
        dbErr instanceof Error ? dbErr.message : dbErr,
      );
      return jsonError("Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.", 503);
    }

    if (!user) {
      void writeAuditLog(null, "auth.login.failed", "login", {
        email: parseResult.data.email.toLowerCase(),
      });
      return jsonError("Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.", 401);
    }

    const verified = await verifyUserPassword(user, parseResult.data.password);
    if (!verified.ok) {
      void writeAuditLog(
        { userId: user.id, email: user.email, fullName: user.fullName, role: user.role },
        "auth.login.failed",
        user.id,
      );
      return jsonError(verified.message, verified.status);
    }

    if (userRequiresTwoFactor(user.preferencesJson)) {
      void writeAuditLog(
        { userId: user.id, email: user.email, fullName: user.fullName, role: user.role },
        "auth.login.2fa_pending",
        user.id,
      );
      return pendingTwoFactorResponse(user.id);
    }

    void writeAuditLog(
      { userId: user.id, email: user.email, fullName: user.fullName, role: user.role },
      "auth.login.success",
      user.id,
    );
    return issueSession(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "JWT_SECRET_UNSAFE") {
      console.error("[Auth Login] JWT_SECRET_UNSAFE");
      return jsonError("Không thể tạo phiên đăng nhập. Vui lòng thử lại sau.", 503);
    }
    console.error("[Auth Login] Unexpected error:", error);
    return jsonError("Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại sau.", 500);
  }
}
