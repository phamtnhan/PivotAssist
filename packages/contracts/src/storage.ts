import { z } from "zod";

export const FilePurposeSchema = z.enum([
  "RESUME_PDF",
  "INTERVIEW_RECORDING",
  "PROFILE_PICTURE",
  "PORTFOLIO_ASSET",
]);
export type FilePurpose = z.infer<typeof FilePurposeSchema>;

export const PresignedUploadRequestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z
    .string()
    .regex(
      /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|video\/webm|image\/png|image\/jpeg)$/,
    ),
  fileSizeBytes: z.number().max(100 * 1024 * 1024), // 100MB cap
  purpose: FilePurposeSchema,
});
export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;

export const PresignedUploadResponseSchema = z.object({
  fileAssetId: z.string(),
  uploadUrl: z.string().url(),
  downloadUrl: z.string().url(),
  expiresInSeconds: z.number(),
  headers: z.record(z.string()).optional(),
});
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;
