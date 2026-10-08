import { NextResponse } from "next/server";
import { z } from "zod";
import type { CareerRoadmap } from "@pivotassist/contracts";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

const phases = ["PHASE_30_DAYS", "PHASE_60_DAYS", "PHASE_90_DAYS"] as const;
const phaseTitles: Record<(typeof phases)[number], string> = {
  PHASE_30_DAYS: "Chặng 1: Nền tảng",
  PHASE_60_DAYS: "Chặng 2: Thực hành",
  PHASE_90_DAYS: "Chặng 3: Sẵn sàng ứng tuyển",
};
const resourceTypes = new Set(["COURSE", "BOOK", "DOCUMENTATION", "PROJECT", "VIDEO"]);
const costTypes = new Set(["FREE", "PAID"]);

const PatchSchema = z
  .object({
    stepId: z.string().trim().min(1),
    isCompleted: z.boolean(),
  })
  .strict();

function toRoadmapResponse(roadmap: Awaited<ReturnType<typeof loadRoadmap>>): CareerRoadmap {
  if (!roadmap) throw new Error("ROADMAP_NOT_FOUND");
  return {
    id: roadmap.id,
    userId: roadmap.userId,
    targetRole: roadmap.targetRole,
    createdAt: roadmap.createdAt.toISOString(),
    progressPercentage: Math.max(0, Math.min(100, roadmap.progressPercentage)),
    milestones: phases.map((phase) => {
      const steps = roadmap.steps.filter((step) => step.phase === phase);
      return {
        phase,
        title: phaseTitles[phase],
        subtitle: "Lộ trình miễn phí theo tiến độ cá nhân",
        description: steps.map((step) => step.description).join(" "),
        tasks: steps.map((step) => ({
          id: step.id,
          title: step.title,
          description: step.description,
          targetSkill: step.skill?.name ?? step.title,
          estimatedDays: Math.max(1, (step.orderIndex + 1) * 2),
          isCompleted: step.isCompleted,
          resources: step.resources.map((resource) => ({
            id: resource.id,
            title: resource.title,
            provider: resource.provider,
            url: resource.url,
            type: resourceTypes.has(resource.resourceType)
              ? (resource.resourceType as "COURSE" | "BOOK" | "DOCUMENTATION" | "PROJECT" | "VIDEO")
              : "DOCUMENTATION",
            estimatedHours: resource.estimatedHours,
            costType: costTypes.has(resource.costType)
              ? (resource.costType as "FREE" | "PAID")
              : "FREE",
          })),
        })),
      };
    }),
  };
}

function loadRoadmap(userId: string) {
  return prisma.roadmap.findFirst({
    where: { userId },
    include: {
      steps: { include: { skill: true, resources: true }, orderBy: { orderIndex: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem lộ trình.", 401);

  try {
    const roadmap = await loadRoadmap(user.userId);
    if (!roadmap)
      return errorResponse(
        "Bạn chưa có lộ trình nghề nghiệp. Hãy cập nhật hồ sơ và kỹ năng trước.",
        404,
        "ROADMAP_NOT_FOUND",
      );
    return NextResponse.json({ success: true, roadmap: toRoadmapResponse(roadmap) });
  } catch (error) {
    console.error("[Roadmap GET]", error);
    return errorResponse("Không thể tải lộ trình nghề nghiệp.", 503);
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để cập nhật lộ trình.", 401);
  if (user.role !== "CANDIDATE")
    return errorResponse("Chỉ tài khoản ứng viên mới cập nhật được lộ trình.", 403);
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse("Dữ liệu cập nhật lộ trình không hợp lệ.", 400, "ROADMAP_UPDATE_INVALID");

  try {
    const step = await prisma.roadmapStep.findFirst({
      where: { id: parsed.data.stepId, roadmap: { userId: user.userId } },
      select: { id: true, roadmapId: true },
    });
    if (!step)
      return errorResponse(
        "Nhiệm vụ không tồn tại hoặc không thuộc lộ trình của bạn.",
        404,
        "ROADMAP_STEP_NOT_FOUND",
      );

    const result = await prisma.$transaction(async (tx) => {
      const updatedStep = await tx.roadmapStep.update({
        where: { id: step.id },
        data: {
          isCompleted: parsed.data.isCompleted,
          completedAt: parsed.data.isCompleted ? new Date() : null,
        },
        select: { id: true, isCompleted: true, completedAt: true },
      });
      const [totalSteps, completedSteps] = await Promise.all([
        tx.roadmapStep.count({ where: { roadmapId: step.roadmapId } }),
        tx.roadmapStep.count({ where: { roadmapId: step.roadmapId, isCompleted: true } }),
      ]);
      const progressPercentage =
        totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
      const roadmap = await tx.roadmap.update({
        where: { id: step.roadmapId },
        data: { progressPercentage },
        select: { id: true, progressPercentage: true, updatedAt: true },
      });
      return { updatedStep, roadmap };
    });

    return NextResponse.json({
      success: true,
      step: result.updatedStep,
      progressPercentage: result.roadmap.progressPercentage,
      updatedAt: result.roadmap.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[Roadmap PATCH]", error);
    return errorResponse("Không thể cập nhật tiến độ lộ trình.", 503, "ROADMAP_UPDATE_FAILED");
  }
}
