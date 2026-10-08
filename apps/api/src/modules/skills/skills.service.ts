import { Injectable, NotFoundException } from "@nestjs/common";
import { extractSkills } from "@pivotassist/free-ai";
import { prisma } from "@pivotassist/db";
import { CareerPivotAssessment, CareerRoadmap } from "@pivotassist/contracts";

function skillRecord(
  name: string,
  status: "TRANSFERABLE" | "ADJACENT" | "MISSING" | "PROFICIENT",
  levelScore: number,
) {
  return {
    id: `free-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    category: "INFERRED",
    type: "HARD" as const,
    status,
    levelScore,
  };
}

@Injectable()
export class SkillsService {
  async getCareerAssessment(userId: string, targetRole: string): Promise<CareerPivotAssessment> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        resumes: { where: { isActive: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException("User không tồn tại.");
    const resumeText = user.resumes[0]?.parsedText ?? "";
    const currentSkills = extractSkills(resumeText);
    const targetSkills = extractSkills(targetRole);
    const effectiveTargets =
      targetSkills.length > 0
        ? targetSkills
        : ["System Design", "Communication", "Delivery ownership"];
    const transferable = effectiveTargets.filter((skill) => currentSkills.includes(skill));
    const missing = effectiveTargets.filter((skill) => !currentSkills.includes(skill));
    const adjacent = currentSkills.filter((skill) => !effectiveTargets.includes(skill)).slice(0, 4);
    const technicalFit = Math.round(
      (transferable.length / Math.max(1, effectiveTargets.length)) * 100,
    );
    return {
      currentRole: user.profile?.currentJobTitle ?? "Chưa cập nhật",
      targetRole,
      overallFeasibilityScore: Math.max(45, Math.min(96, 60 + technicalFit / 2)),
      estimatedMonthsToTransition: missing.length > 5 ? 6 : missing.length > 2 ? 3 : 2,
      transferableSkillsCount: transferable.length,
      missingSkillsCount: missing.length,
      radarScores: {
        technicalFit,
        experienceFit: Math.min(95, 50 + (user.profile?.yearsOfExperience ?? 0) * 8),
        domainFit: Math.max(45, technicalFit - 4),
        softSkillsFit: currentSkills.some((skill) =>
          ["Leadership", "Communication"].includes(skill),
        )
          ? 90
          : 68,
      },
      skillsBreakdown: {
        transferable: transferable.map((skill) => skillRecord(skill, "TRANSFERABLE", 85)),
        adjacent: adjacent.map((skill) => skillRecord(skill, "ADJACENT", 68)),
        missing: missing.map((skill) => skillRecord(skill, "MISSING", 35)),
      },
      alternativeRoleRecommendations: adjacent
        .slice(0, 3)
        .map((skill, index) => ({
          roleTitle: `${skill} Specialist`,
          matchPercentage: Math.max(65, 86 - index * 7),
          difficulty: index === 0 ? ("EASY" as const) : ("MODERATE" as const),
          bridgeSkills: missing.slice(0, 2),
        })),
    };
  }

  async getRoadmap(userId: string): Promise<CareerRoadmap> {
    const roadmap = await prisma.roadmap.findFirst({
      where: { userId },
      include: {
        steps: { include: { skill: true, resources: true }, orderBy: { orderIndex: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!roadmap) throw new NotFoundException("Roadmap chưa được khởi tạo.");
    const phases = ["PHASE_30_DAYS", "PHASE_60_DAYS", "PHASE_90_DAYS"] as const;
    return {
      id: roadmap.id,
      userId: roadmap.userId,
      targetRole: roadmap.targetRole,
      createdAt: roadmap.createdAt.toISOString(),
      progressPercentage: roadmap.progressPercentage,
      milestones: phases.map((phase) => ({
        phase,
        title:
          phase === "PHASE_30_DAYS"
            ? "Chặng 1: Nền tảng"
            : phase === "PHASE_60_DAYS"
              ? "Chặng 2: Thực hành"
              : "Chặng 3: Sẵn sàng ứng tuyển",
        subtitle: "Lộ trình miễn phí theo tiến độ cá nhân",
        description: roadmap.steps
          .filter((step) => step.phase === phase)
          .map((step) => step.description)
          .join(" "),
        tasks: roadmap.steps
          .filter((step) => step.phase === phase)
          .map((step) => ({
            id: step.id,
            title: step.title,
            description: step.description,
            targetSkill: step.skill?.name ?? step.title,
            estimatedDays: Math.max(1, step.orderIndex * 2),
            isCompleted: step.isCompleted,
            resources: step.resources.map((resource) => ({
              id: resource.id,
              title: resource.title,
              provider: resource.provider,
              url: resource.url,
              type: resource.resourceType as
                "COURSE" | "BOOK" | "DOCUMENTATION" | "PROJECT" | "VIDEO",
              estimatedHours: resource.estimatedHours,
              costType: resource.costType as "FREE" | "PAID",
            })),
          })),
      })),
    };
  }
}
