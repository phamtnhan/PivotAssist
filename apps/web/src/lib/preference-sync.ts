"use client";

import { asIdList } from "@/lib/id-list";

export type PreferenceListKey = "jobBookmarks" | "favoriteTracks";

export function readLocalIdList(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    return asIdList(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function writeLocalIdList(storageKey: string, ids: string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(asIdList(ids)));
  } catch {
    /* quota */
  }
}

export async function persistPreferenceList(
  key: PreferenceListKey,
  ids: string[],
): Promise<boolean> {
  const response = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferencesJson: { [key]: asIdList(ids) } }),
  }).catch(() => null);
  return Boolean(response?.ok);
}
