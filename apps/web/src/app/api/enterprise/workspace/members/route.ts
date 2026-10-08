import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { hasEnterpriseCapability, isEnterpriseUser } from "@/lib/enterprise-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().email(),
    role: z.enum(["RECRUITER", "INTERVIEWER"]).default("RECRUITER"),
  })
  .strict();

async function getCompany(user: { userId: string; role: string }) {
  if (user.role === "ADMIN")
    return prisma.company.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const membership = await prisma.companyMember.findFirst({
    where: { userId: user.userId },
    select: { companyId: true },
  });
  return membership ? { id: membership.companyId } : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const company = await getCompany(user);
  if (!company) return errorResponse("Chưa có không gian doanh nghiệp.", 404);
  const members = await prisma.companyMember.findMany({
    where: { companyId: company.id },
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true, isActive: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ success: true, members });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(
      parsed.error.errors[0]?.message ?? "Thông tin thành viên không hợp lệ.",
      400,
    );
  const company = await getCompany(user);
  if (!company) return errorResponse("Chưa có không gian doanh nghiệp.", 404);
  if (!(await hasEnterpriseCapability(user, "members:write", company.id)))
    return errorResponse("Chỉ chủ sở hữu hoặc quản trị mới được thêm thành viên.", 403);
  const membership = await prisma.companyMember
    .findUnique({
      where: { companyId_userId: { companyId: company.id, userId: user.userId } },
      select: { role: true },
    })
    .catch(() => null);
  if (
    (user.role !== "ADMIN" && !membership) ||
    (user.role !== "ADMIN" && !["OWNER", "ADMIN"].includes(membership?.role ?? ""))
  )
    return errorResponse("Chỉ chủ sở hữu hoặc quản trị mới được thêm thành viên.", 403);
  try {
    const email = parsed.data.email.toLowerCase().trim();
    const memberUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true },
    });
    if (!memberUser) {
      return errorResponse(
        "Tài khoản chưa tồn tại. Thành viên cần đăng ký trước khi được thêm vào workspace.",
        409,
      );
    }
    // Do not overwrite existing user's global fullName (FINDING-05)
    const member = await prisma.$transaction(async (tx) => {
      if (memberUser.id !== user.userId) {
        await tx.user.update({
          where: { id: memberUser.id },
          data: { role: "RECRUITER" },
        });
      }
      return tx.companyMember.upsert({
        where: { companyId_userId: { companyId: company.id, userId: memberUser.id } },
        create: { companyId: company.id, userId: memberUser.id, role: parsed.data.role },
        update: { role: parsed.data.role },
      });
    });
    await writeAuditLog(user, "workspace.member_upserted", member.id, {
      email,
      role: parsed.data.role,
    });
    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error) {
    console.error("[Workspace Member POST]", error);
    return errorResponse("Không thể thêm thành viên công ty.", 503);
  }
}
