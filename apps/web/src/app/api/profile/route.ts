import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { disallowedOriginResponse } from "@/lib/request-origin";
import { errorResponse, iso, writeAuditLog } from "@/lib/server-utils";
import { mergePreferences, publicPreferences, toInputJsonValue } from "@/lib/user-preferences";

const ProfilePatchSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    currentJobTitle: z.string().trim().max(180).nullable().optional(),
    targetJobTitle: z.string().trim().max(180).nullable().optional(),
    yearsOfExperience: z.number().int().min(0).max(60).optional(),
    targetSalaryMin: z.number().min(0).max(10_000_000).nullable().optional(),
    targetSalaryMax: z.number().min(0).max(10_000_000).nullable().optional(),
    currency: z.string().trim().min(3).max(8).optional(),
    preferredLanguage: z.enum(["vi", "en"]).optional(),
    bio: z.string().max(5000).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    dateOfBirth: z.string().datetime().nullable().optional(),
    location: z.string().trim().max(180).nullable().optional(),
    preferencesJson: z.record(z.unknown()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.targetSalaryMin !== null &&
      data.targetSalaryMin !== undefined &&
      data.targetSalaryMax !== null &&
      data.targetSalaryMax !== undefined &&
      data.targetSalaryMin > data.targetSalaryMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetSalaryMax"],
        message: "Mức lương tối đa phải lớn hơn hoặc bằng mức tối thiểu.",
      });
    }
  });

function serialize(user: any) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    preferencesJson: publicPreferences(user.preferencesJson),
    profile: user.profile
      ? {
          ...user.profile,
          dateOfBirth: iso(user.profile.dateOfBirth),
        }
      : null,
    resumes: (user.resumes ?? []).map((resume: any) => ({
      id: resume.id,
      isActive: resume.isActive,
      filename: resume.fileAsset?.filename,
      updatedAt: resume.updatedAt.toISOString(),
    })),
  };
}

const include = {
  profile: true,
  resumes: {
    select: {
      id: true,
      isActive: true,
      updatedAt: true,
      fileAsset: { select: { filename: true } },
    },
  },
};

export async function GET() {
  const authUser = await getCurrentUser();
  if (!authUser) return errorResponse("Bạn cần đăng nhập để xem hồ sơ.", 401);
  try {
    const user = await prisma.user.findUnique({ where: { id: authUser.userId }, include });
    if (!user) return errorResponse("Tài khoản không tồn tại.", 404);
    return NextResponse.json({ success: true, user: serialize(user) });
  } catch (error) {
    console.error("[Profile GET]", error);
    return errorResponse("Không thể tải hồ sơ.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const originDenied = disallowedOriginResponse(request);
  if (originDenied) return originDenied;
  const authUser = await getCurrentUser();
  if (!authUser) return errorResponse("Bạn cần đăng nhập để cập nhật hồ sơ.", 401);
  const parsed = ProfilePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Dữ liệu hồ sơ không hợp lệ.", 400);

  const { fullName, preferencesJson, dateOfBirth, ...profileData } = parsed.data;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (fullName !== undefined || preferencesJson !== undefined) {
        const current = await tx.user.findUnique({
          where: { id: authUser.userId },
          select: { preferencesJson: true },
        });
        const existing =
          current?.preferencesJson &&
          typeof current.preferencesJson === "object" &&
          !Array.isArray(current.preferencesJson)
            ? (current.preferencesJson as Record<string, unknown>)
            : {};
        await tx.user.update({
          where: { id: authUser.userId },
          data: {
            fullName,
            preferencesJson:
              preferencesJson === undefined
                ? undefined
                : toInputJsonValue(
                    mergePreferences(existing, JSON.parse(JSON.stringify(preferencesJson))),
                  ),
          },
        });
      }
      await tx.profile.upsert({
        where: { userId: authUser.userId },
        create: {
          userId: authUser.userId,
          ...profileData,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        },
        update: {
          ...profileData,
          dateOfBirth:
            dateOfBirth === undefined ? undefined : dateOfBirth ? new Date(dateOfBirth) : null,
        },
      });
      return tx.user.findUnique({ where: { id: authUser.userId }, include });
    });
    await writeAuditLog(authUser, "profile.updated", authUser.userId, parsed.data);
    return NextResponse.json({ success: true, user: serialize(updated) });
  } catch (error) {
    console.error("[Profile PATCH]", error);
    return errorResponse("Không thể cập nhật hồ sơ.", 503);
  }
}
