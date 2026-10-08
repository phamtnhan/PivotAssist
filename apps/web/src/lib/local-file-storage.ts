import path from "node:path";
import { unlink } from "node:fs/promises";

const LOCAL_PREFIX = "local:";

/**
 * Resolves a `local:...` file key to an absolute filesystem path strictly contained
 * within the `.data` directory under `cwd`.
 * Returns `null` if the key is invalid, contains null bytes, contains directory traversal
 * sequences (`..`), or resolves outside the intended `.data` root.
 */
export function resolveLocalDataAbsolutePath(fileKey: string, cwd = process.cwd()): string | null {
  if (!fileKey || typeof fileKey !== "string") return null;
  if (!fileKey.startsWith(LOCAL_PREFIX) || fileKey.includes("..") || fileKey.includes("\0"))
    return null;
  const relativePart = fileKey.slice(LOCAL_PREFIX.length);
  const dataRoot = path.resolve(cwd, ".data");
  const absolutePath = path.resolve(dataRoot, relativePart);
  const relative = path.relative(dataRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return absolutePath;
}

/**
 * Safely deletes a file corresponding to a `local:...` fileKey if it exists on disk.
 */
export async function deleteLocalFile(fileKey: string, cwd = process.cwd()): Promise<boolean> {
  const filePath = resolveLocalDataAbsolutePath(fileKey, cwd);
  if (!filePath) return false;
  try {
    await unlink(filePath);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT") return false;
    console.warn(`[deleteLocalFile] Failed to remove ${filePath}:`, error?.message ?? error);
    return false;
  }
}
