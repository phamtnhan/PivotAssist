import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getSessionUser, prisma } from "@/lib/auth";
import { extractSkills } from "@pivotassist/free-ai";
import {
  ENTERPRISE_JOB_INCLUDE,
  findAccessibleJobs,
  hasEnterpriseCapability,
  mapEnterpriseJobs,
  requireEnterpriseUser,
} from "@/lib/enterprise-server";
import { isGarbageOrgName } from "@/lib/org-name";
import { errorResponse } from "@/lib/server-utils";

const RubricItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  weight: z.number().min(0).max(100),
  description: z.string().trim().min(1).max(500),
});

const CreateJobSchema = z.object({
  title: z.string().trim().min(2).max(180),
  department: z.string().trim().max(120).optional(),
  location: z.string().trim().min(2).max(180),
  employmentType: z.string().trim().min(1).max(80).default("FULL_TIME"),
  salaryRange: z.string().trim().max(120).optional(),
  descriptionRaw: z.string().trim().min(20).max(20000),
  companyName: z.string().trim().min(2).max(180).optional(),
  hiringCount: z.number().int().min(1).max(100).default(1),
  rubric: z.array(RubricItemSchema).max(30).default([]),
  interviewQuestions: z.array(z.string().trim().min(1).max(1000)).max(50).default([]),
  isPublished: z.boolean().default(true),
});

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  "Toàn thời gian (Full-time)": "FULL_TIME",
  "Linh hoạt (kết hợp)": "HYBRID",
  "Linh hoạt (Hybrid)": "HYBRID",
  "Từ xa (Remote)": "REMOTE",
};

function normalizeEmploymentType(value: string): string {
  return (
    EMPLOYMENT_TYPE_MAP[value] ??
    (value
      .toUpperCase()
      .replace(/[^A-Z_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80) ||
      "FULL_TIME")
  );
}

export async function GET(request: NextRequest) {
  const user = await requireEnterpriseUser(await getSessionUser());
  if (!user) {
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  }

  try {
    const jobs = await findAccessibleJobs(user);
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = url.searchParams.get("status");
    const filtered = jobs.filter((job) => {
      const matchesQuery =
        !query || `${job.title} ${job.company.name} ${job.location}`.toLowerCase().includes(query);
      const archived = Boolean(job.archivedAt);
      const matchesStatus =
        status === "archived"
          ? archived || !job.isPublished
          : status === "all"
            ? true
            : !archived && job.isPublished;
      return matchesQuery && matchesStatus;
    });
    return NextResponse.json(
      { success: true, jobs: await mapEnterpriseJobs(filtered), total: filtered.length },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Enterprise Jobs GET] Database error:", error?.message);
    return errorResponse("Không thể tải danh sách tin tuyển dụng.", 503);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireEnterpriseUser(await getCurrentUser());
  if (!user) {
    return errorResponse(
      "Bạn cần đăng nhập bằng tài khoản doanh nghiệp để tạo tin tuyển dụng.",
      401,
    );
  }

  const parseResult = CreateJobSchema.safeParse(await req.json().catch(() => null));
  if (!parseResult.success) {
    return errorResponse(
      parseResult.error.errors[0]?.message ?? "Dữ liệu tin tuyển dụng không hợp lệ.",
      400,
    );
  }

  const data = parseResult.data;
  const totalWeight = data.rubric.reduce((total, item) => total + item.weight, 0);
  if (data.rubric.length > 0 && Math.abs(totalWeight - 100) > 0.01) {
    return errorResponse("Tổng trọng số rubric phải bằng 100%.", 400);
  }

  try {
    let companyId: string | undefined;
    const membership =
      user.role === "ADMIN"
        ? null
        : await prisma.companyMember.findFirst({
            where: { userId: user.userId },
            select: { companyId: true },
          });
    companyId = membership?.companyId;
    if (membership && !(await hasEnterpriseCapability(user, "jobs:write", membership.companyId))) {
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    }

    if (!companyId && user.role === "ADMIN") {
      const company = await prisma.company.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      companyId = company?.id;
    }

    if (!companyId) {
      const companyName = data.companyName ?? `${user.fullName} — không gian doanh nghiệp`;
      if (isGarbageOrgName(companyName)) {
        return errorResponse(
          "Tên doanh nghiệp không hợp lệ. Dùng tên công ty thật (không phải chuỗi test như 12dâfaf).",
          400,
        );
      }
      const company = await prisma.company.create({
        data: {
          name: companyName,
          members: {
            create: { userId: user.userId, role: user.role === "ADMIN" ? "ADMIN" : "OWNER" },
          },
        },
        select: { id: true },
      });
      companyId = company.id;
    }

    if (user.role !== "ADMIN") {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { maxJobs: true, verificationStatus: true },
      });
      if (!company) return errorResponse("Không gian doanh nghiệp không tồn tại.", 404);
      if (data.isPublished && company.verificationStatus !== "VERIFIED") {
        return errorResponse(
          "Doanh nghiệp chưa được xác minh danh tính. Tin tuyển dụng chỉ có thể lưu nháp cho tới khi được duyệt.",
          403,
        );
      }
      const activeJobs = await prisma.job.count({
        where: { companyId, isPublished: true, archivedAt: null },
      });
      if (activeJobs >= company.maxJobs)
        return errorResponse(
          `Không gian doanh nghiệp đã đạt hạn mức ${company.maxJobs} tin đang tuyển.`,
          409,
        );
    }

    const inferredSkills = extractSkills(`${data.title}\n${data.descriptionRaw}`);

    const job = await prisma.job.create({
      data: {
        companyId,
        title: data.title,
        department: data.department || null,
        location: data.location,
        employmentType: normalizeEmploymentType(data.employmentType),
        salaryRange: data.salaryRange || null,
        descriptionRaw: data.descriptionRaw,
        hiringCount: data.hiringCount,
        isPublished: data.isPublished,
        rubricJson: data.rubric,
        interviewQuestionsJson: data.interviewQuestions,
        jobSkills:
          inferredSkills.length > 0
            ? {
                create: inferredSkills.map((name) => ({
                  isRequired: true,
                  skill: {
                    connectOrCreate: {
                      where: { name },
                      create: { name, category: "INFERRED", type: "HARD" },
                    },
                  },
                })),
              }
            : undefined,
      },
      include: ENTERPRISE_JOB_INCLUDE,
    });

    const [mapped] = await mapEnterpriseJobs([job]);
    const { publishJobsChanged, publishPipelineChanged } = await import("@/lib/realtime-hub");
    publishJobsChanged();
    publishPipelineChanged();
    return NextResponse.json({ success: true, job: mapped }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return errorResponse("Tên doanh nghiệp đã được sử dụng. Vui lòng chọn tên khác.", 409);
    }
    console.error("[Enterprise Jobs POST] Database error:", error?.message);
    return errorResponse("Không thể tạo tin tuyển dụng.", 503);
  }
}
