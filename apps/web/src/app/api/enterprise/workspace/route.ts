import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  ENTERPRISE_ROLES,
  hasEnterpriseCapability,
  isEnterpriseUser,
} from "@/lib/enterprise-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const PatchSchema = z
  .object({
    name: z.string().trim().min(2).max(180).optional(),
    taxId: z.string().trim().min(5).max(40).nullable().optional(),
    businessModel: z.string().trim().max(120).nullable().optional(),
    companySize: z.string().trim().max(80).nullable().optional(),
    industry: z.string().trim().max(160).nullable().optional(),
    headquarters: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    websiteUrl: z.string().url().nullable().optional().or(z.literal("")),
    notificationEmail: z.string().email().nullable().optional(),
  })
  .strict();

async function companyFor(user: { userId: string; role: string }) {
  if (user.role === "ADMIN") return prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  const member = await prisma.companyMember.findFirst({
    where: { userId: user.userId },
    include: { company: true },
  });
  return member?.company ?? null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  try {
    const company = await companyFor(user);
    if (!company) return errorResponse("Chưa có không gian doanh nghiệp.", 404);
    const [members, usedJobs] = await Promise.all([
      prisma.companyMember.findMany({
        where: { companyId: company.id },
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true, isActive: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.job.count({ where: { companyId: company.id, isPublished: true, archivedAt: null } }),
    ]);
    return NextResponse.json({ success: true, workspace: { ...company, members, usedJobs } });
  } catch (error) {
    console.error("[Workspace GET]", error);
    return errorResponse("Không thể tải không gian doanh nghiệp.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Dữ liệu công ty không hợp lệ.", 400);
  try {
    const company = await companyFor(user);
    if (!company) return errorResponse("Chưa có không gian doanh nghiệp.", 404);
    if (!(await hasEnterpriseCapability(user, "workspace:write", company.id)))
      return errorResponse("Chỉ chủ sở hữu hoặc quản trị công ty mới được sửa thông tin.", 403);
    if (user.role !== "ADMIN") {
      const membership = await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId: company.id, userId: user.userId } },
        select: { role: true },
      });
      if (!membership || !["OWNER", "ADMIN"].includes(membership.role))
        return errorResponse("Chỉ chủ sở hữu hoặc quản trị công ty mới được sửa thông tin.", 403);
    }
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: parsed.data.name,
        taxId: parsed.data.taxId === undefined ? undefined : parsed.data.taxId,
        businessModel:
          parsed.data.businessModel === undefined ? undefined : parsed.data.businessModel,
        companySize: parsed.data.companySize === undefined ? undefined : parsed.data.companySize,
        industry: parsed.data.industry === undefined ? undefined : parsed.data.industry,
        headquarters: parsed.data.headquarters === undefined ? undefined : parsed.data.headquarters,
        description: parsed.data.description === undefined ? undefined : parsed.data.description,
        websiteUrl: parsed.data.websiteUrl === "" ? null : parsed.data.websiteUrl,
        notificationEmail: parsed.data.notificationEmail,
      },
    });
    await writeAuditLog(user, "workspace.updated", company.id, parsed.data);
    return NextResponse.json({ success: true, workspace: updated });
  } catch (error: any) {
    if (error?.code === "P2002")
      return errorResponse("Tên doanh nghiệp hoặc mã số thuế đã được sử dụng.", 409);
    console.error("[Workspace PATCH]", error?.message ?? error);
    return errorResponse("Không thể cập nhật thông tin công ty.", 503);
  }
}
