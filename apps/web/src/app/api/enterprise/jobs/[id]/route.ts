import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractSkills } from "@pivotassist/free-ai";
import { getCurrentUser, prisma } from "@/lib/auth";
import {
  findAccessibleJob,
  hasEnterpriseCapability,
  isEnterpriseUser,
  mapEnterpriseJobs,
  toEnterpriseJob,
} from "@/lib/enterprise-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const RubricItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  weight: z.number().min(0).max(100),
  description: z.string().trim().min(1).max(500),
});
const PatchSchema = z
  .object({
    title: z.string().trim().min(2).max(180).optional(),
    department: z.string().trim().max(120).nullable().optional(),
    location: z.string().trim().min(2).max(180).optional(),
    employmentType: z.string().trim().min(1).max(80).optional(),
    salaryRange: z.string().trim().max(120).nullable().optional(),
    descriptionRaw: z.string().trim().min(20).max(20000).optional(),
    hiringCount: z.number().int().min(1).max(100).optional(),
    rubric: z.array(RubricItemSchema).max(30).optional(),
    interviewQuestions: z.array(z.string().trim().min(1).max(1000)).max(50).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const job = await findAccessibleJob(user, id);
    if (!job)
      return errorResponse("Tin tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.", 404);
    const [mapped] = await mapEnterpriseJobs([job]);
    return NextResponse.json({ success: true, job: mapped });
  } catch (error) {
    console.error("[Enterprise Job GET]", error);
    return errorResponse("Không thể tải tin tuyển dụng.", 503);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(
      parsed.error.errors[0]?.message ?? "Dữ liệu tin tuyển dụng không hợp lệ.",
      400,
    );
  const { id } = await context.params;
  try {
    const existing = await findAccessibleJob(user, id);
    if (!existing)
      return errorResponse("Tin tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "jobs:write", existing.companyId)))
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    if (parsed.data.rubric) {
      const total = parsed.data.rubric.reduce((sum, item) => sum + item.weight, 0);
      if (parsed.data.rubric.length > 0 && Math.abs(total - 100) > 0.01)
        return errorResponse("Tổng trọng số rubric phải bằng 100%.", 400);
    }
    if (parsed.data.isPublished === true && user.role !== "ADMIN") {
      const company = await prisma.company.findUnique({
        where: { id: existing.companyId },
        select: { verificationStatus: true },
      });
      if (company?.verificationStatus !== "VERIFIED") {
        return errorResponse(
          "Doanh nghiệp chưa được xác minh danh tính. Không thể đăng công khai tin tuyển dụng.",
          403,
        );
      }
    }
    const updated = await prisma.job.update({
      where: { id },
      data: {
        title: parsed.data.title,
        department: parsed.data.department,
        location: parsed.data.location,
        employmentType:
          parsed.data.employmentType
            ?.toUpperCase()
            .replace(/[^A-Z_]/g, "_")
            .replace(/_+/g, "_") || undefined,
        salaryRange: parsed.data.salaryRange,
        descriptionRaw: parsed.data.descriptionRaw,
        hiringCount: parsed.data.hiringCount,
        rubricJson: parsed.data.rubric,
        interviewQuestionsJson: parsed.data.interviewQuestions,
        isPublished: parsed.data.isPublished,
        archivedAt: parsed.data.isPublished === true ? null : undefined,
      },
    });
    // Keep the free-first skill index in sync when the JD changes.
    if (parsed.data.title || parsed.data.descriptionRaw) {
      const inferredSkills = extractSkills(
        `${parsed.data.title ?? existing.title}\n${parsed.data.descriptionRaw ?? existing.descriptionRaw}`,
      );
      if (inferredSkills.length > 0) {
        for (const name of inferredSkills) {
          await prisma.jobSkill
            .upsert({
              where: {
                jobId_skillId: {
                  jobId: id,
                  skillId: (
                    await prisma.skill.upsert({
                      where: { name },
                      create: { name, category: "INFERRED", type: "HARD" },
                      update: {},
                    })
                  ).id,
                },
              },
              create: {
                jobId: id,
                skillId: (await prisma.skill.findUniqueOrThrow({ where: { name } })).id,
                isRequired: true,
              },
              update: {},
            })
            .catch(() => null);
        }
      }
    }
    const refreshed = await findAccessibleJob(user, updated.id);
    await writeAuditLog(user, "job.updated", id, parsed.data);
    const mapped = refreshed ? (await mapEnterpriseJobs([refreshed]))[0] : updated;
    return NextResponse.json({ success: true, job: mapped });
  } catch (error) {
    console.error("[Enterprise Job PATCH]", error);
    return errorResponse("Không thể cập nhật tin tuyển dụng.", 503);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isEnterpriseUser(user))
    return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 401);
  const { id } = await context.params;
  try {
    const existing = await findAccessibleJob(user, id);
    if (!existing)
      return errorResponse("Tin tuyển dụng không tồn tại hoặc bạn không có quyền truy cập.", 404);
    if (!(await hasEnterpriseCapability(user, "jobs:write", existing.companyId)))
      return errorResponse("Thành viên INTERVIEWER chỉ có quyền xem và đánh giá phỏng vấn.", 403);
    await prisma.job.update({
      where: { id },
      data: { isPublished: false, archivedAt: new Date() },
    });
    await writeAuditLog(user, "job.archived", id);
    return NextResponse.json({ success: true, archivedId: id });
  } catch (error) {
    console.error("[Enterprise Job DELETE]", error);
    return errorResponse("Không thể lưu trữ tin tuyển dụng.", 503);
  }
}
