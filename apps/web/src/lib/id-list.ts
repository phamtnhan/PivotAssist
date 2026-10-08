/** Allowlisted preference arrays: job bookmarks and practice favorites. */
const MAX_IDS = 200;
const MAX_ID_LEN = 80;

export function asIdList(value: unknown, max = MAX_IDS): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || id.length > MAX_ID_LEN || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
