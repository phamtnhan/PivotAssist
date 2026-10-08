// REQ-0018 / REQ-0023 — Nest uses the same fail-closed JWT_SECRET rules as Next
export const HISTORICAL_JWT_FALLBACK =
  "pivotassist_super_secret_jwt_key_antigravity_2026_change_me_in_prod";

export function isUnsafeJwtSecret(secret: string | undefined | null): boolean {
  const value = (secret ?? "").trim();
  if (value.length < 16) return true;
  if (value === HISTORICAL_JWT_FALLBACK) return true;
  if (process.env.NODE_ENV === "production" && /change_me/i.test(value)) return true;
  return false;
}

export function resolvedJwtSecret(): string | null {
  const value = process.env.JWT_SECRET?.trim() ?? "";
  if (isUnsafeJwtSecret(value)) return null;
  return value;
}
