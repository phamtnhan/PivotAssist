// REQ-0027 — reject disallowed browser Origin on state-changing hiring routes
import { errorResponse } from "@/lib/server-utils";
import { isAllowedBrowserOrigin } from "@/lib/browser-origins";

export function disallowedOriginResponse(request: Request) {
  if (isAllowedBrowserOrigin(request)) return null;
  return errorResponse("Origin không được phép.", 403);
}
