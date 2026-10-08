import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, prisma } from "@/lib/auth";
import { errorResponse } from "@/lib/server-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để xem kỹ năng.", 401);
  try {
    const skills = await prisma.userSkill.findMany({
      where: { userId: user.userId },
      include: { skill: true },
      orderBy: { levelScore: "desc" },
    });
    return NextResponse.json({
      success: true,
      skills: skills.map((item) => ({
        id: item.skill.id,
        name: item.skill.name,
        category: item.skill.category,
        type: item.skill.type,
        status: item.status,
        levelScore: item.levelScore,
        yearsOfExperience: item.yearsOfExperience,
      })),
    });
  } catch (error) {
    console.error("[Skills GET]", error);
    return errorResponse("Không thể tải kỹ năng.", 503);
  }
}

const SkillPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    category: z.string().trim().max(80).default("CUSTOM"),
    levelScore: z.number().int().min(0).max(100).default(80),
    status: z.enum(["TRANSFERABLE", "ADJACENT", "MISSING", "PROFICIENT"]).default("PROFICIENT"),
    yearsOfExperience: z.number().min(0).max(60).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Bạn cần đăng nhập để thêm kỹ năng.", 401);
  const parsed = SkillPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Skill không hợp lệ.", 400);
  try {
    const skill = await prisma.skill.upsert({
      where: { name: parsed.data.name },
      create: { name: parsed.data.name, category: parsed.data.category, type: "HARD" },
      update: { category: parsed.data.category },
    });
    const userSkill = await prisma.userSkill.upsert({
      where: { userId_skillId: { userId: user.userId, skillId: skill.id } },
      create: {
        userId: user.userId,
        skillId: skill.id,
        levelScore: parsed.data.levelScore,
        status: parsed.data.status,
        yearsOfExperience: parsed.data.yearsOfExperience,
      },
      update: {
        levelScore: parsed.data.levelScore,
        status: parsed.data.status,
        yearsOfExperience: parsed.data.yearsOfExperience,
      },
    });
    return NextResponse.json(
      {
        success: true,
        skill: {
          id: skill.id,
          userSkillId: userSkill.id,
          name: skill.name,
          category: skill.category,
          type: skill.type,
          status: userSkill.status,
          levelScore: userSkill.levelScore,
          yearsOfExperience: userSkill.yearsOfExperience,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Skills POST]", error);
    return errorResponse("Không thể lưu kỹ năng.", 503);
  }
}
