import { generateInterviewQuestions, type FreeInterviewQuestion } from "@pivotassist/free-ai";
import { generateGeminiJson, geminiProviderLabel, isGeminiConfigured } from "@/lib/gemini-server";
import { sanitizeInterviewPrompt } from "@/lib/interview-copy";
import { createTtlCache } from "@/lib/ttl-cache";

const CATEGORIES = new Set(["behavioral", "technical", "system_design", "domain", "culture_fit"]);

type QuestionInput = {
  jobTitle: string;
  jobDescription: string;
  resumeText?: string;
  configuredQuestions?: string[];
  limit?: number;
  language?: "vi" | "en";
  /** 0 = không chờ Gemini trên request (dùng cache hoặc bộ sẵn). */
  timeoutMs?: number;
};

type BankGlobal = typeof globalThis & {
  __pivotQuestionBank?: ReturnType<typeof createTtlCache<FreeInterviewQuestion[]>>;
  __pivotQuestionFail?: ReturnType<typeof createTtlCache<true>>;
  __pivotQuestionInflight?: Map<string, Promise<FreeInterviewQuestion[] | null>>;
};

function questionBank() {
  const g = globalThis as BankGlobal;
  g.__pivotQuestionBank ??= createTtlCache<FreeInterviewQuestion[]>(80, 15 * 60_000);
  g.__pivotQuestionFail ??= createTtlCache<true>(40, 60_000);
  g.__pivotQuestionInflight ??= new Map();
  return {
    cache: g.__pivotQuestionBank,
    fail: g.__pivotQuestionFail,
    inflight: g.__pivotQuestionInflight,
  };
}

/** Cùng vị trí + tin + số câu dùng chung một bộ — nhiều ứng viên không gọi Gemini song song. */
export function interviewQuestionBankKey(
  input: Pick<QuestionInput, "jobTitle" | "jobDescription" | "limit" | "language">,
) {
  const title = input.jobTitle.trim().toLowerCase();
  const jd = (input.jobDescription ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  return `${input.language ?? "vi"}:${input.limit ?? 8}:${title}:${jd}`;
}

function heuristicQuestions(input: QuestionInput, limit: number): FreeInterviewQuestion[] {
  return generateInterviewQuestions({ ...input, limit }).map((question) => ({
    ...question,
    prompt: sanitizeInterviewPrompt(question.prompt, input.language),
  }));
}

function parseGeminiQuestions(
  raw: Array<{ prompt?: string; category?: string; targetSkills?: string[] }> | undefined,
  limit: number,
  language: QuestionInput["language"],
): FreeInterviewQuestion[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((item) => item && typeof item.prompt === "string" && item.prompt.trim().length >= 12)
    .slice(0, limit)
    .map((item, index) => ({
      id: `gemini-q-${index + 1}`,
      order: index + 1,
      category: CATEGORIES.has(item.category ?? "")
        ? (item.category as FreeInterviewQuestion["category"])
        : "behavioral",
      prompt: sanitizeInterviewPrompt(String(item.prompt).trim(), language),
      targetSkills: Array.isArray(item.targetSkills)
        ? item.targetSkills
            .filter((skill): skill is string => typeof skill === "string")
            .slice(0, 6)
        : [],
    }));
}

async function fetchGeminiQuestions(
  input: QuestionInput,
  limit: number,
  timeoutMs: number,
): Promise<FreeInterviewQuestion[] | null> {
  const result = await generateGeminiJson<{
    questions?: Array<{ prompt?: string; category?: string; targetSkills?: string[] }>;
  }>({
    timeoutMs,
    maxAttempts: 1,
    maxOutputTokens: 500,
    fallbackModels: [],
    system:
      "Bạn là người phỏng vấn. Chỉ hỏi dựa trên tin tuyển dụng và CV. Trả JSON, không markdown.",
    prompt: `Tạo đúng ${limit} câu hỏi ngắn (${input.language === "en" ? "English" : "tiếng Việt"}). JSON {questions:[{prompt,category,targetSkills}]}. category: behavioral|technical|system_design|domain|culture_fit.\nVị trí: ${input.jobTitle}\nTin:\n${(input.jobDescription ?? "").replace(/\s+/g, " ").trim().slice(0, 1800)}\nCV:\n${(input.resumeText ?? "").replace(/\s+/g, " ").trim().slice(0, 1200)}`,
  });
  const questions = parseGeminiQuestions(result.questions, limit, input.language);
  return questions.length >= 3 ? questions : null;
}

/** Lấp bank sau khi đã trả session — lần sau cùng vị trí lấy cache, không chờ mạng. */
export function warmInterviewQuestionBank(input: QuestionInput) {
  if (!isGeminiConfigured()) return;
  const configured = (input.configuredQuestions ?? []).map((item) => item.trim()).filter(Boolean);
  if (configured.length > 0) return;
  const limit = input.limit ?? 8;
  const key = interviewQuestionBankKey({ ...input, limit });
  const { cache, fail, inflight } = questionBank();
  if (cache.get(key) || fail.get(key) || inflight.has(key)) return;
  const pending = fetchGeminiQuestions(input, limit, 8_000)
    .then((questions) => {
      if (questions) cache.set(key, questions);
      else fail.set(key, true);
      return questions;
    })
    .catch((error: unknown) => {
      fail.set(key, true);
      console.warn(
        "[Interview questions] warm bank",
        error instanceof Error ? error.message : error,
      );
      return null;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, pending);
}

export async function resolveInterviewQuestions(
  input: QuestionInput,
): Promise<{ questions: FreeInterviewQuestion[]; provider: string }> {
  const limit = input.limit ?? 8;
  const configured = (input.configuredQuestions ?? []).map((item) => item.trim()).filter(Boolean);
  if (configured.length > 0) {
    return {
      questions: generateInterviewQuestions({
        ...input,
        configuredQuestions: configured,
        limit,
      }).map((question) => ({
        ...question,
        prompt: sanitizeInterviewPrompt(question.prompt, input.language),
      })),
      provider: "job-configured",
    };
  }

  const key = interviewQuestionBankKey({ ...input, limit });
  const cached = questionBank().cache.get(key);
  if (cached && cached.length >= 3) {
    return { questions: cached.slice(0, limit), provider: "question-bank" };
  }

  const heuristic = heuristicQuestions(input, limit);
  const timeoutMs = input.timeoutMs ?? 0;
  if (!isGeminiConfigured() || timeoutMs <= 0) {
    return { questions: heuristic, provider: "free-heuristic-v1" };
  }

  try {
    const timed = await Promise.race([
      fetchGeminiQuestions(input, limit, timeoutMs)
        .then((questions) => ({ type: "ok" as const, questions }))
        .catch((error: unknown) => ({ type: "err" as const, error })),
      new Promise<{ type: "timeout" }>((resolve) => {
        setTimeout(() => resolve({ type: "timeout" }), timeoutMs);
      }),
    ]);
    if (timed.type === "ok" && timed.questions) {
      questionBank().cache.set(key, timed.questions);
      return { questions: timed.questions, provider: geminiProviderLabel() };
    }
    if (timed.type === "err") {
      console.warn(
        "[Interview questions] Gemini lỗi — dùng bộ câu hỏi sẵn",
        timed.error instanceof Error ? timed.error.message : timed.error,
      );
    }
  } catch (error) {
    console.warn(
      "[Interview questions] Gemini chậm hoặc lỗi — dùng bộ câu hỏi sẵn",
      error instanceof Error ? error.message : error,
    );
  }
  return { questions: heuristic, provider: "free-heuristic-v1" };
}
