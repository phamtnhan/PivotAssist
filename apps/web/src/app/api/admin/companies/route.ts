import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse, paginationFromRequest, writeAuditLog } from "@/lib/server-utils";

const PatchSchema = z
  .object({
    companyId: z.string().min(1),
    verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    maxJobs: z.number().int().min(0).max(10000).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới xem được doanh nghiệp.", 403);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const verificationStatus = url.searchParams.get("status");
  const { page, pageSize, skip } = paginationFromRequest(request, { pageSize: 50 });
  try {
    const where = {
      ...(q ? { OR: [{ name: { contains: q } }, { taxId: { contains: q } }] } : {}),
      ...(verificationStatus && verificationStatus !== "all"
        ? { verificationStatus: verificationStatus as "PENDING" | "VERIFIED" | "REJECTED" }
        : {}),
    };
    const [companies, total] = await prisma.$transaction([
      prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { jobs: true, members: true } } },
      }),
      prisma.company.count({ where }),
    ]);
    const activeJobCounts = await prisma.job.groupBy({
      by: ["companyId"],
      where: {
        companyId: { in: companies.map((company) => company.id) },
        isPublished: true,
        archivedAt: null,
      },
      _count: { _all: true },
    });
    const activeByCompany = new Map(activeJobCounts.map((row) => [row.companyId, row._count._all]));
    const mappedCompanies = companies.map((company) => ({
      ...company,
      _count: { ...company._count, jobs: activeByCompany.get(company.id) ?? 0 },
    }));
    return NextResponse.json({
      success: true,
      companies: mappedCompanies,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[Admin Companies GET]", error);
    return errorResponse("Không thể tải danh sách doanh nghiệp.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN")
    return errorResponse("Chỉ quản trị viên mới cập nhật được doanh nghiệp.", 403);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    (parsed.data.verificationStatus === undefined && parsed.data.maxJobs === undefined)
  )
    return errorResponse("Dữ liệu doanh nghiệp không hợp lệ.", 400);
  try {
    const company = await prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: parsed.data.companyId },
        data: { verificationStatus: parsed.data.verificationStatus, maxJobs: parsed.data.maxJobs },
      });
      if (parsed.data.verificationStatus === "REJECTED") {
        await tx.job.updateMany({
          where: { companyId: parsed.data.companyId },
          data: { isPublished: false, archivedAt: new Date() },
        });
      }
      return updated;
    });
    await writeAuditLog(admin, "admin.company_updated", company.id, parsed.data);
    return NextResponse.json({ success: true, company });
  } catch (error) {
    console.error("[Admin Companies PATCH]", error);
    return errorResponse("Không thể cập nhật doanh nghiệp.", 503);
  }
}
