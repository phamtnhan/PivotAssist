import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractSkills, generateInterviewQuestions } from "@pivotassist/free-ai";
import { getCurrentUser } from "@/lib/auth";
import { hasEnterpriseCapability, requireEnterpriseUser } from "@/lib/enterprise-server";
import { analyzeJobWithGemini, GeminiRequestError, isGeminiConfigured } from "@/lib/gemini-server";
import { errorResponse, writeAuditLog } from "@/lib/server-utils";

const Schema = z
  .object({
    title: z.string().trim().min(2).max(180),
    descriptionRaw: z.string().trim().min(20).max(20000),
  })
  .strict();
const AnalysisSchema = z.object({
  title: z.string().min(2),
  summary: z.string(),
  requiredSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  rubric: z.array(z.object({ label: z.string(), weight: z.number(), description: z.string() })),
  interviewQuestions: z.array(z.string()),
});

function normalizeRubric(items: Array<{ label: string; weight: number; description: string }>) {
  const source =
    items.length > 0
      ? items.slice(0, 10)
      : [
          {
            label: "Technical reasoning",
            weight: 100,
            description: "Năng lực chuyên môn và cách suy luận.",
          },
        ];
  const total = source.reduce((sum, item) => sum + Math.max(0, item.weight), 0) || 1;
  const normalized = source.map((item) => ({
    ...item,
    weight: Math.round((Math.max(0, item.weight) / total) * 100),
  }));
  const difference = 100 - normalized.reduce((sum, item) => sum + item.weight, 0);
  normalized[normalized.length - 1].weight += difference;
  return normalized;
}

export async function POST(request: NextRequest) {
  const user = await requireEnterpriseUser(await getCurrentUser());
  if (!user) return errorResponse("Bạn cần đăng nhập bằng tài khoản doanh nghiệp.", 403);
  if (!(await hasEnterpriseCapability(user, "jobs:write")))
    return errorResponse(
      "Thành viên INTERVIEWER không có quyền tạo phân tích tin tuyển dụng.",
      403,
    );
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(parsed.error.errors[0]?.message ?? "Tin tuyển dụng không hợp lệ.", 400);
  try {
    const freeSkills = extractSkills(`${parsed.data.title}\n${parsed.data.descriptionRaw}`);
    const fallback = {
      title: parsed.data.title,
      summary: parsed.data.descriptionRaw.split(/\r?\n/).filter(Boolean).slice(0, 3).join(" "),
      requiredSkills: freeSkills,
      niceToHaveSkills: [],
      rubric: normalizeRubric(
        freeSkills
          .slice(0, 4)
          .map((skill, index) => ({
            label: skill,
            weight: [35, 25, 20, 20][index] ?? 10,
            description: `Đánh giá evidence về ${skill}.`,
          })),
      ),
      interviewQuestions: generateInterviewQuestions({
        jobTitle: parsed.data.title,
        jobDescription: parsed.data.descriptionRaw,
        limit: 8,
      }).map((question) => question.prompt),
    };
    if (isGeminiConfigured()) {
      const gemini = await analyzeJobWithGemini(parsed.data);
      const validGemini = AnalysisSchema.safeParse(gemini);
      if (!validGemini.success) {
        return errorResponse(
          "Gemini đã cấu hình nhưng trả JSON không khớp schema. Không fallback heuristic.",
          503,
          "GEMINI_FAILED",
        );
      }
      const analysis = { ...validGemini.data, rubric: normalizeRubric(validGemini.data.rubric) };
      await writeAuditLog(user, "enterprise.job_ai_analyzed", parsed.data.title, {
        provider: "gemini",
      });
      return NextResponse.json({
        success: true,
        analysis,
        provider: "gemini",
        geminiConfigured: true,
      });
    }
    await writeAuditLog(user, "enterprise.job_ai_analyzed", parsed.data.title, {
      provider: "free-heuristic-v1",
    });
    return NextResponse.json({
      success: true,
      analysis: fallback,
      provider: "free-heuristic-v1",
      geminiConfigured: false,
    });
  } catch (error) {
    console.error("[Enterprise AI Analyze Job]", error instanceof Error ? error.message : error);
    if (error instanceof GeminiRequestError)
      return errorResponse(error.message, 503, "GEMINI_FAILED");
    return errorResponse("Không thể phân tích tin tuyển dụng.", 503);
  }
}
