import type { Prisma } from "@prisma/client";

const MAX_PREF_IDS = 200;
const MAX_PREF_ID_LEN = 80;

function asIdList(value: unknown, max = MAX_PREF_IDS): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || id.length > MAX_PREF_ID_LEN || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export type UserPreferences = Record<string, unknown>;

export function asPreferences(value: unknown): UserPreferences {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as UserPreferences) }
    : {};
}

/** Prisma JSON write boundary — do not pass UserPreferences straight into preferencesJson. */
export function toInputJsonValue(value: UserPreferences): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** `null` = no quota key (legacy/free). A number is an enforced credit balance. */
export function remainingSessionCredits(value: unknown): number | null {
  const remaining = asPreferences(value).remainingSessions;
  return typeof remaining === "number" && Number.isFinite(remaining) ? remaining : null;
}

/** Client PATCH must never write entitlement or TOTP authority. */
export const CLIENT_LOCKED_PREFERENCE_KEYS = [
  "totpSecretEncrypted",
  "totpSecretPending",
  "twoFactorEnabled",
  "remainingSessions",
  "plan",
  "billingStatus",
  "billingProvider",
  "activatedInvoiceIds",
  "passwordChangedAt",
] as const;

export function stripClientLockedPreferences(patch: Record<string, unknown>): UserPreferences {
  const sanitized = { ...patch };
  for (const key of CLIENT_LOCKED_PREFERENCE_KEYS) delete sanitized[key];
  if ("jobBookmarks" in sanitized) sanitized.jobBookmarks = asIdList(sanitized.jobBookmarks);
  if ("favoriteTracks" in sanitized) sanitized.favoriteTracks = asIdList(sanitized.favoriteTracks);
  return sanitized;
}

export function publicPreferences(value: unknown): UserPreferences {
  const prefs = asPreferences(value);
  delete prefs.totpSecretEncrypted;
  delete prefs.totpSecretPending;
  return prefs;
}

export function mergePreferences(
  current: unknown,
  patch: Record<string, unknown>,
): UserPreferences {
  const existing = asPreferences(current);
  return { ...existing, ...stripClientLockedPreferences(patch) };
}

export function isTwoFactorEnabled(value: unknown): boolean {
  const prefs = asPreferences(value);
  return prefs.twoFactorEnabled === true && typeof prefs.totpSecretEncrypted === "string";
}
