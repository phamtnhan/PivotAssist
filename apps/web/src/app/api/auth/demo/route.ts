import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, getCurrentUser, prisma } from "@/lib/auth";
import { requireEnterpriseUser } from "@/lib/enterprise-server";
import { errorResponse } from "@/lib/server-utils";
import {
  isDemoAdminUpsertAllowed,
  isDemoAuthEnabled,
  sessionCookieSetOptions,
} from "@/lib/session-cookie";

// REQ-0021 — demo auth disabled in production; ADMIN opt-in; no password literals in source

const Schema = z
  .object({
    role: z.enum(["CANDIDATE", "RECRUITER", "ADMIN"]).default("RECRUITER"),
  })
  .strict();

const DEMO_EMAILS = {
  CANDIDATE: "nam.nguyen@example.com",
  RECRUITER: "recruiter@nexusai.local",
  ADMIN: "admin@pivotassist.local",
} as const;

export async function POST(request: NextRequest) {
  if (!isDemoAuthEnabled()) {
    return errorResponse("Không tìm thấy tài nguyên.", 404);
  }

  const parsed = Schema.safeParse(await request.json().catch(() => ({ role: "RECRUITER" })));
  if (!parsed.success) {
    return errorResponse("Role demo không hợp lệ.", 400);
  }

  const role = parsed.data.role;
  if (role === "ADMIN" && !isDemoAdminUpsertAllowed()) {
    return errorResponse("Không được phép tạo phiên demo ADMIN.", 403);
  }
  const email = DEMO_EMAILS[role];

  try {
    const current = await getCurrentUser();
    if (current && role === "RECRUITER") {
      const enterprise = await requireEnterpriseUser(current);
      if (enterprise) {
        const token = await createSessionToken(enterprise);
        const response = NextResponse.json({
          success: true,
          user: {
            id: enterprise.userId,
            email: enterprise.email,
            fullName: enterprise.fullName,
            role: enterprise.role,
          },
        });
        response.cookies.set(sessionCookieSetOptions(token));
        return response;
      }
    }

    let user = await prisma.user.findFirst({
      where: { email, role, isActive: true },
      select: { id: true, email: true, fullName: true, role: true },
    });
    if (!user) {
      const defaultNames = {
        CANDIDATE: "Nguyễn Thành Nam",
        RECRUITER: "Phạm Thành Nhân",
        ADMIN: "PivotAssist Admin",
      };
      user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          fullName: defaultNames[role],
          role,
          isActive: true,
          profile: {
            create: {
              currentJobTitle:
                role === "CANDIDATE"
                  ? "Senior Frontend Engineer"
                  : role === "RECRUITER"
                    ? "Talent Partner"
                    : "Administrator",
              preferredLanguage: "vi",
              currency: "VND",
            },
          },
        },
        update: { role, isActive: true },
        select: { id: true, email: true, fullName: true, role: true },
      });
    }

    if (role === "RECRUITER") {
      const member = await prisma.companyMember.findFirst({ where: { userId: user.id } });
      if (!member) {
        const company = await prisma.company.upsert({
          where: { name: "NexusAI Vietnam" },
          create: { name: "NexusAI Vietnam", verificationStatus: "VERIFIED", maxJobs: 10 },
          update: { verificationStatus: "VERIFIED" },
        });
        await prisma.companyMember
          .create({
            data: { companyId: company.id, userId: user.id, role: "OWNER" },
          })
          .catch(() => null);
      }
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
    response.cookies.set(sessionCookieSetOptions(token));
    return response;
  } catch (error: unknown) {
    console.error("[Auth Demo]", error instanceof Error ? error.message : error);
    return errorResponse("Không thể tạo phiên demo.", 503);
  }
}
