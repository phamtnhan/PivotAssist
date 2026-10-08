// REQ-0027 — Origin allowlist for browser POSTs
export function allowedBrowserOrigins(): Set<string> {
  const origins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (app) origins.add(app);
  return origins;
}

export function isAllowedBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return allowedBrowserOrigins().has(origin);
}
