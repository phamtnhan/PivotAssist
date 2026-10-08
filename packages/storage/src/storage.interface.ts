import { PresignedUploadRequest, PresignedUploadResponse } from "@pivotassist/contracts";

export interface IStorageService {
  createPresignedUploadUrl(
    request: PresignedUploadRequest,
    options: { ownerUserId: string },
  ): Promise<PresignedUploadResponse>;
  createPresignedDownloadUrl(fileKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(fileKey: string): Promise<void>;
  fileExists(fileKey: string): Promise<boolean>;
}
