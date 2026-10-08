/** Cookie name kept here so middleware does not import Prisma/auth. */
export const SESSION_COOKIE_NAME = "pivotassist_session";

const SESSION_PREFIXES = [
  "/home",
  "/dashboard",
  "/roadmap",
  "/applications",
  "/profiles",
  "/settings",
  "/interview",
  "/face-to-face",
  "/admin",
] as const;

const ENTERPRISE_SESSION_PREFIXES = [
  "/enterprise/dashboard",
  "/enterprise/jobs",
  "/enterprise/candidates",
  "/enterprise/analytics",
  "/enterprise/settings",
  "/enterprise/applications",
] as const;

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isSessionRequiredPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (SESSION_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)))
    return true;
  return ENTERPRISE_SESSION_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
