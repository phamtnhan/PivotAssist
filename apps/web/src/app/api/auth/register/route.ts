import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, hashPassword, createSessionToken } from "@/lib/auth";
import { attachSessionCookie } from "@/lib/auth-session";
import { jsonError } from "@/lib/server-utils";

// REQ-0028 — register 503 must not include DB exception details

const RegisterSchema = z.object({
  fullName: z.string().min(2, "Họ và tên phải có tối thiểu 2 ký tự"),
  email: z.string().email("Địa chỉ email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  // ADMIN accounts are provisioned out-of-band; public registration must not
  // allow privilege escalation by submitting role=ADMIN.
  role: z.enum(["CANDIDATE", "RECRUITER"]).default("CANDIDATE"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RegisterSchema.safeParse(body);

    if (!parseResult.success) {
      return jsonError(parseResult.error.errors[0]?.message || "Dữ liệu đăng ký không hợp lệ", 400);
    }

    const { fullName, email, password, role } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    let existingUser = null;
    try {
      existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
    } catch (dbErr: unknown) {
      console.error(
        "[Auth Register] Database connection error:",
        dbErr instanceof Error ? dbErr.message : dbErr,
      );
      return jsonError("Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.", 503);
    }

    if (existingUser) {
      return jsonError(
        "Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác.",
        409,
      );
    }

    // Hash password and create User + Profile
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role,
        profile: {
          create: {
            preferredLanguage: "vi",
            currency: "VND",
          },
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    // Create session JWT token
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Đăng ký tài khoản thành công!",
        user,
      },
      { status: 201 },
    );

    return attachSessionCookie(response, token);
  } catch (error: any) {
    console.error("[Auth Register] Unexpected error:", error);
    return jsonError("Đã xảy ra lỗi khi tạo tài khoản. Vui lòng thử lại sau.", 500);
  }
}
