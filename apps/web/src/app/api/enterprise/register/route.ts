import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  comparePassword,
  createSessionToken,
  hashPassword,
  prisma,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(40),
    email: z.string().email(),
    password: z.string().min(6).max(128),
    companyName: z.string().trim().min(2).max(180),
    taxId: z.string().trim().max(40).optional().or(z.literal("")),
    businessModel: z.string().trim().max(120).optional(),
    companySize: z.string().trim().max(80).optional(),
    industry: z.string().trim().max(160).optional(),
    websiteUrl: z.string().url().optional().or(z.literal("")),
    location: z.string().trim().max(180).optional(),
    companyBio: z.string().max(5000).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(
      parsed.error.errors[0]?.message ?? "Thông tin doanh nghiệp không hợp lệ.",
      400,
    );
  const data = parsed.data;
  const email = data.email.toLowerCase().trim();
  try {
    const companyCreate = {
      name: data.companyName,
      taxId: data.taxId || null,
      websiteUrl: data.websiteUrl || null,
      businessModel: data.businessModel || null,
      companySize: data.companySize || null,
      industry: data.industry || null,
      headquarters: data.location || null,
      description: data.companyBio || null,
      notificationEmail: email,
      verificationStatus: "PENDING" as const,
    };
    const userSelect = {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
      companyMemberships: { select: { companyId: true, role: true } },
    } as const;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        passwordHash: true,
        isActive: true,
        companyMemberships: { select: { companyId: true } },
      },
    });

    let user;
    if (existing) {
      if (!existing.isActive)
        return errorResponse("Tài khoản đang bị tạm khóa. Vui lòng liên hệ hỗ trợ.", 403);
      if (existing.companyMemberships.length > 0)
        return errorResponse(
          "Email này đã thuộc một không gian doanh nghiệp. Hãy đăng nhập để quản lý workspace hiện tại hoặc dùng email khác để đăng ký.",
          409,
        );
      if (
        !existing.passwordHash ||
        !(await comparePassword(data.password, existing.passwordHash))
      ) {
        return errorResponse(
          "Email này đã được sử dụng. Đăng nhập đúng mật khẩu để nâng cấp không gian doanh nghiệp.",
          409,
        );
      }
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: data.fullName,
          role: existing.role === "ADMIN" ? "ADMIN" : "RECRUITER",
          profile: {
            upsert: {
              create: {
                phone: data.phone,
                location: data.location || null,
                bio: data.companyBio || null,
                preferredLanguage: "vi",
                currency: "VND",
              },
              update: {
                phone: data.phone,
                location: data.location || null,
                bio: data.companyBio || null,
              },
            },
          },
          companyMemberships:
            existing.companyMemberships.length === 0
              ? {
                  create: { role: "OWNER", company: { create: companyCreate } },
                }
              : undefined,
        },
        select: userSelect,
      });
    } else {
      user = await prisma.user.create({
        data: {
          fullName: data.fullName,
          email,
          passwordHash: await hashPassword(data.password),
          role: "RECRUITER",
          profile: {
            create: {
              phone: data.phone,
              location: data.location || null,
              bio: data.companyBio || null,
              preferredLanguage: "vi",
              currency: "VND",
            },
          },
          companyMemberships: {
            create: {
              role: "OWNER",
              company: { create: companyCreate },
            },
          },
        },
        select: userSelect,
      });
    }
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
    const response = NextResponse.json(
      {
        success: true,
        user,
        companyId: user.companyMemberships[0]?.companyId,
        message: "Đã tạo không gian doanh nghiệp. Hồ sơ pháp nhân đang chờ xác thực.",
      },
      { status: 201 },
    );
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    await writeAuditLog(
      { userId: user.id, email: user.email, fullName: user.fullName, role: user.role },
      "enterprise.registered",
      user.id,
      { companyId: user.companyMemberships[0]?.companyId },
    );
    return response;
  } catch (error: any) {
    if (error?.code === "P2002")
      return errorResponse("Tên doanh nghiệp hoặc mã số thuế đã được sử dụng.", 409);
    console.error("[Enterprise Register]", error?.message ?? error);
    return errorResponse("Không thể tạo không gian doanh nghiệp.", 503);
  }
}
