import { NextResponse, type NextRequest } from "next/server";
import { isAllowedBrowserOrigin } from "@/lib/browser-origins";
import { isSessionRequiredPath, SESSION_COOKIE_NAME } from "@/lib/session-paths";

const WEBHOOK_PATHS = ["/api/billing/momo/ipn"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;

  if (path.startsWith("/api/")) {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) return NextResponse.next();
    if (WEBHOOK_PATHS.some((item) => path === item || path.startsWith(`${item}/`)))
      return NextResponse.next();
    if (isAllowedBrowserOrigin(request)) return NextResponse.next();
    return NextResponse.json({ success: false, error: "Origin không được phép." }, { status: 403 });
  }

  if (isSessionRequiredPath(path) && !request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/home",
    "/home/:path*",
    "/dashboard",
    "/roadmap",
    "/applications",
    "/applications/:path*",
    "/profiles",
    "/profiles/:path*",
    "/settings",
    "/settings/:path*",
    "/interview",
    "/interview/:path*",
    "/face-to-face",
    "/face-to-face/:path*",
    "/admin",
    "/admin/:path*",
    "/enterprise/:path*",
  ],
};
