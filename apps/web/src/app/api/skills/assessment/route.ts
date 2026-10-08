import { NextRequest, NextResponse } from "next/server";
import { extractSkills } from "@pivotassist/free-ai";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem đánh giá kỹ năng.", 401);
  const targetRole =
    new URL(request.url).searchParams.get("targetRole")?.trim() || "AI Solutions Architect";
  try {
    const [profile, resume] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: user.userId } }),
      prisma.resume.findFirst({
        where: { userId: user.userId, isActive: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const currentSkills = extractSkills(resume?.parsedText ?? "");
    const targetSkills = extractSkills(targetRole);
    const targets =
      targetSkills.length > 0
        ? targetSkills
        : ["System Design", "Communication", "Delivery ownership"];
    const transferable = targets.filter((skill) => currentSkills.includes(skill));
    const missing = targets.filter((skill) => !currentSkills.includes(skill));
    const adjacent = currentSkills.filter((skill) => !targets.includes(skill)).slice(0, 5);
    const skill = (name: string, status: string, levelScore: number) => ({
      id: `free-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      category: "INFERRED",
      type: "HARD",
      status,
      levelScore,
    });
    const technicalFit = Math.round((transferable.length / Math.max(1, targets.length)) * 100);
    return NextResponse.json({
      success: true,
      assessment: {
        currentRole: profile?.currentJobTitle ?? "Chưa cập nhật",
        targetRole,
        overallFeasibilityScore: Math.max(45, Math.min(96, 60 + technicalFit / 2)),
        estimatedMonthsToTransition: missing.length > 3 ? 3 : 2,
        transferableSkillsCount: transferable.length,
        missingSkillsCount: missing.length,
        radarScores: {
          technicalFit,
          experienceFit: Math.min(95, 50 + (profile?.yearsOfExperience ?? 0) * 8),
          domainFit: Math.max(45, technicalFit - 4),
          softSkillsFit: currentSkills.includes("Communication") ? 90 : 68,
        },
        skillsBreakdown: {
          transferable: transferable.map((name) => skill(name, "TRANSFERABLE", 85)),
          adjacent: adjacent.map((name) => skill(name, "ADJACENT", 68)),
          missing: missing.map((name) => skill(name, "MISSING", 35)),
        },
        alternativeRoleRecommendations: adjacent
          .slice(0, 3)
          .map((name, index) => ({
            roleTitle: `${name} Specialist`,
            matchPercentage: 86 - index * 6,
            difficulty: index === 0 ? "EASY" : "MODERATE",
            bridgeSkills: missing.slice(0, 2),
          })),
      },
    });
  } catch (error) {
    console.error("[Skills Assessment GET]", error);
    return errorResponse("Không thể tạo đánh giá kỹ năng.", 503);
  }
}
