import path from "node:path";

const LOCAL_PREFIX = "local:";

export function isSafeAvatarKey(key: string, userId: string): boolean {
  if (!userId || key.includes("\0") || key.includes("..")) return false;
  const prefix = `local:uploads/avatars/${userId}/`;
  if (!key.startsWith(prefix)) return false;
  const filename = key.slice(prefix.length);
  if (!filename || filename.includes("/") || filename.includes("\\")) return false;
  return true;
}

export function parseAvatarKey(key: string): { targetUserId: string; filename: string } | null {
  if (!key || key.includes("\0") || key.includes("..")) return null;
  const prefix = "local:uploads/avatars/";
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const parts = rest.split("/");
  if (parts.length !== 2) return null;
  const [targetUserId, filename] = parts;
  if (!targetUserId || !filename || filename.includes("\\")) return null;
  return { targetUserId, filename };
}

export function resolveAvatarAbsolutePath(key: string, cwd = process.cwd()): string | null {
  if (!key.startsWith(LOCAL_PREFIX) || key.includes("..") || key.includes("\0")) return null;
  const dataRoot = path.resolve(cwd, ".data");
  const absolutePath = path.resolve(dataRoot, key.slice(LOCAL_PREFIX.length));
  const relative = path.relative(dataRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return absolutePath;
}
