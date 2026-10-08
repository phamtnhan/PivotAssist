import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { CloudflareR2StorageService } from "@pivotassist/storage";
import { PresignedUploadRequest, PresignedUploadResponse } from "@pivotassist/contracts";

@Injectable()
export class StorageService {
  private r2Client: CloudflareR2StorageService;

  constructor() {
    this.r2Client = new CloudflareR2StorageService({
      accountId: process.env.R2_ACCOUNT_ID || "mock_account_id",
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "mock_key_id",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "mock_secret",
      bucketName: process.env.R2_BUCKET_NAME || "pivotassist-files",
      customDomain: process.env.R2_CUSTOM_DOMAIN,
    });
  }

  async generatePresignedUpload(
    request: PresignedUploadRequest,
    ownerUserId: string,
  ): Promise<PresignedUploadResponse> {
    if (
      process.env.NODE_ENV === "production" &&
      (!process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID === "mock_key_id")
    ) {
      throw new ServiceUnavailableException("Object storage is not configured.");
    }
    return this.r2Client.createPresignedUploadUrl(request, { ownerUserId });
  }
}
