import { FilePurpose } from "@pivotassist/contracts";

// REQ-0030 — reject .. / NUL; owned object keys only

export interface FilePolicyRule {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  bucketPrefix: string;
}

export const FILE_POLICIES: Record<FilePurpose, FilePolicyRule> = {
  RESUME_PDF: {
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    bucketPrefix: "resumes",
  },
  INTERVIEW_RECORDING: {
    allowedMimeTypes: ["video/webm", "audio/webm", "video/mp4"],
    maxSizeBytes: 500 * 1024 * 1024, // 500MB
    bucketPrefix: "recordings",
  },
  PROFILE_PICTURE: {
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    bucketPrefix: "avatars",
  },
  PORTFOLIO_ASSET: {
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    bucketPrefix: "portfolio",
  },
};

export function canonicalizeObjectKeyPart(value: string, label: string): string {
  if (
    !value ||
    value.includes("\0") ||
    value.includes("..") ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw new Error(`Unsafe ${label} in object key`);
  }
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildOwnedObjectKey(
  ownerUserId: string,
  bucketPrefix: string,
  fileAssetId: string,
  filename: string,
): string {
  const owner = canonicalizeObjectKeyPart(ownerUserId, "owner");
  const name = canonicalizeObjectKeyPart(filename.replace(/[^a-zA-Z0-9.-]/g, "_"), "filename");
  const prefix = canonicalizeObjectKeyPart(bucketPrefix, "prefix");
  const asset = canonicalizeObjectKeyPart(fileAssetId, "asset");
  return `users/${owner}/${prefix}/${asset}_${name}`;
}

export function validateFilePolicy(
  purpose: FilePurpose,
  mimeType: string,
  fileSizeBytes: number,
): void {
  const policy = FILE_POLICIES[purpose];
  if (!policy) {
    throw new Error(`Chính sách lưu trữ không xác định cho mục đích: ${purpose}`);
  }

  const normalizedMime = mimeType.split(";")[0]?.trim().toLowerCase() || mimeType;
  if (!policy.allowedMimeTypes.includes(normalizedMime)) {
    throw new Error(
      `Định dạng file '${mimeType}' không được hỗ trợ cho ${purpose}. Chỉ chấp nhận: ${policy.allowedMimeTypes.join(", ")}`,
    );
  }

  if (fileSizeBytes > policy.maxSizeBytes) {
    const maxMB = Math.round(policy.maxSizeBytes / (1024 * 1024));
    throw new Error(`Dung lượng file vượt quá giới hạn cho phép (${maxMB}MB).`);
  }
}
