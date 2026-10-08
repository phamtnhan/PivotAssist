import { Controller, Post, Body } from "@nestjs/common";
import { StorageService } from "./storage.service.js";
import { PresignedUploadResponse, PresignedUploadRequestSchema } from "@pivotassist/contracts";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { NestAuthUser } from "../../auth/jwt-verify.js";

// REQ-0024 — authenticated presign; owner prefix ACL

@Controller("files")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post("presign")
  async createPresignUrl(
    @CurrentUser() user: NestAuthUser,
    @Body() body: unknown,
  ): Promise<PresignedUploadResponse> {
    const validated = PresignedUploadRequestSchema.parse(body);
    return this.storageService.generatePresignedUpload(validated, user.userId);
  }
}
