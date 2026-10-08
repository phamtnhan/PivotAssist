// REQ-0019 — shared session cookie attributes for login / logout / demo
import { SESSION_COOKIE_NAME } from "@/lib/session-paths";

export function isSecureSessionCookie(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") === true;
}

export function sessionCookieSetOptions(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true as const,
    secure: isSecureSessionCookie(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function sessionCookieClearOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true as const,
    secure: isSecureSessionCookie(),
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}

export function isDemoAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_DEMO_AUTH === "0") return false;
  return true;
}

export function isDemoAdminUpsertAllowed(): boolean {
  return isDemoAuthEnabled() && process.env.ALLOW_DEMO_ADMIN === "1";
}
