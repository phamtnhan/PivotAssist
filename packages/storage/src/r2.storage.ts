import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PresignedUploadRequest, PresignedUploadResponse } from "@pivotassist/contracts";
import { IStorageService } from "./storage.interface.js";
import { FILE_POLICIES, validateFilePolicy, buildOwnedObjectKey } from "./file-policy.js";
import { randomUUID } from "node:crypto";

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  customDomain?: string; // e.g., files.pivotassist.io
}

export class CloudflareR2StorageService implements IStorageService {
  private client: S3Client;
  private bucketName: string;
  private customDomain?: string;

  constructor(config: R2StorageConfig) {
    this.bucketName = config.bucketName;
    this.customDomain = config.customDomain;

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async createPresignedUploadUrl(
    request: PresignedUploadRequest,
    options: { ownerUserId: string },
  ): Promise<PresignedUploadResponse> {
    validateFilePolicy(request.purpose, request.mimeType, request.fileSizeBytes);

    const policy = FILE_POLICIES[request.purpose];
    const fileAssetId = `file_${randomUUID()}`;
    const fileKey = buildOwnedObjectKey(
      options.ownerUserId,
      policy.bucketPrefix,
      fileAssetId,
      request.filename,
    );

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: request.mimeType,
      ContentLength: request.fileSizeBytes,
      Metadata: {
        fileAssetId,
        purpose: request.purpose,
      },
    });

    const expiresInSeconds = 900; // 15 minutes
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    const downloadUrl = this.customDomain
      ? `https://${this.customDomain}/${fileKey}`
      : await this.createPresignedDownloadUrl(fileKey, 3600);

    return {
      fileAssetId,
      uploadUrl,
      downloadUrl,
      expiresInSeconds,
      headers: {
        "Content-Type": request.mimeType,
      },
    };
  }

  async createPresignedDownloadUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });
    await this.client.send(command);
  }

  async fileExists(fileKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }
}
