// REQ-0009 — GEMINI_API_KEY server-only; never NEXT_PUBLIC_
// REQ-0026 — production Gemini stays off unless GEMINI_PRODUCTION_ENABLED=1 (DPA HALT)
// REQ-0031 — production text model must be in PINNED_GEMINI_TEXT_MODELS
// REQ-0036 — visual/proctoring events are not sent in evaluateWithGemini context
import type { FreeInterviewEvaluation, FreeRubricItem } from "@pivotassist/free-ai";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY chưa được cấu hình. Evaluation đang dùng heuristic.");
    this.name = "GeminiNotConfiguredError";
  }
}

export class GeminiRequestError extends Error {
  httpStatus?: number;
  constructor(message: string, httpStatus?: number) {
    super(message);
    this.httpStatus = httpStatus;
    this.name = "GeminiRequestError";
  }
}

type GeminiThinkingLevel = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

function clamp(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : fallback;
}

function clip(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function textFromResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (
    payload as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; audioTranscription?: { text?: string } }> };
      }>;
    }
  ).candidates;
  return (
    candidates?.[0]?.content?.parts
      ?.map((part) => part.audioTranscription?.text ?? part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function parseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

function retryDelayMs(attempt: number, httpStatus?: number): number {
  const base = httpStatus === 429 ? 15_000 : 8_000;
  return Math.min(30_000, base * 2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
}

function geminiErrorFromBody(
  payload: unknown,
  status: number,
): { statusName?: string; message?: string } {
  if (!payload || typeof payload !== "object") return {};
  const error = (payload as { error?: { status?: unknown; message?: unknown } }).error;
  return {
    statusName: typeof error?.status === "string" ? error.status : undefined,
    message:
      typeof error?.message === "string"
        ? clip(error.message.replace(/key[^\s]*/gi, "key"), 180)
        : undefined,
  };
}

const PINNED_GEMINI_TEXT_MODELS = new Set([
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]);

export function geminiProductionAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.GEMINI_PRODUCTION_ENABLED === "1";
}

export function geminiModelName(): string {
  const requested = process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-3.5-flash-lite";
  return PINNED_GEMINI_TEXT_MODELS.has(requested) ? requested : "gemini-3.5-flash-lite";
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiProviderLabel(): string {
  return isGeminiConfigured() && geminiProductionAllowed()
    ? `gemini:${geminiModelName()}`
    : "free-heuristic-v1";
}

export async function generateGeminiJson<T>(input: {
  system: string;
  prompt: string;
  model?: string;
  timeoutMs?: number;
  fallbackModels?: string[];
  maxAttempts?: number;
  maxOutputTokens?: number;
  thinkingLevel?: GeminiThinkingLevel | null;
}): Promise<T> {
  if (!geminiProductionAllowed()) throw new GeminiNotConfiguredError();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiNotConfiguredError();
  const models = [
    ...new Set(
      [input.model || geminiModelName(), ...(input.fallbackModels ?? [])].filter(
        (model): model is string => Boolean(model) && PINNED_GEMINI_TEXT_MODELS.has(model),
      ),
    ),
  ];
  if (models.length === 0) models.push(geminiModelName());
  const maxAttempts = input.maxAttempts ?? 3;
  const timeoutMs = input.timeoutMs ?? 90_000;
  const thinkingLevel = input.thinkingLevel === undefined ? "MINIMAL" : input.thinkingLevel;
  let lastError: GeminiRequestError | null = null;

  for (const model of models) {
    let omitThinking = thinkingLevel === null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const started = Date.now();
      let response: Response;
      try {
        response = await fetch(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.system }] },
            contents: [{ role: "user", parts: [{ text: input.prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
              ...(input.maxOutputTokens ? { maxOutputTokens: input.maxOutputTokens } : {}),
              ...(!omitThinking && thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "network error";
        const ms = Date.now() - started;
        lastError = new GeminiRequestError(`Không gọi được Gemini (${detail}).`);
        console.info("[Gemini]", {
          model,
          attempt,
          promptChars: input.prompt.length,
          status: "abort",
          ms,
        });
        if (attempt < maxAttempts && ms < 20_000) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
          continue;
        }
        break;
      }

      const ms = Date.now() - started;
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const detail = geminiErrorFromBody(payload, response.status);
        lastError = new GeminiRequestError(
          `Gemini HTTP ${response.status} cho model ${model}${detail.statusName ? ` (${detail.statusName})` : ""}${detail.message ? `: ${detail.message}` : ""}.`,
          response.status,
        );
        console.info("[Gemini]", {
          model,
          attempt,
          promptChars: input.prompt.length,
          status: response.status,
          ms,
          errorStatus: detail.statusName ?? null,
        });
        if (
          response.status === 400 &&
          !omitThinking &&
          /thinking/i.test(`${detail.message ?? ""} ${detail.statusName ?? ""}`)
        ) {
          omitThinking = true;
          attempt -= 1;
          continue;
        }
        const retryable = response.status === 503 || response.status === 429;
        if (retryable && attempt < maxAttempts && ms < 45_000) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs(attempt, response.status)),
          );
          continue;
        }
        if (response.status === 404) break;
        throw lastError;
      }

      const parsed = parseJson(textFromResponse(await response.json()));
      console.info("[Gemini]", {
        model,
        attempt,
        promptChars: input.prompt.length,
        status: response.status,
        ms,
      });
      if (!parsed || typeof parsed !== "object") {
        throw new GeminiRequestError("Gemini trả về payload không phải JSON hợp lệ.");
      }
      return parsed as T;
    }
  }
  throw lastError ?? new GeminiRequestError("Gemini không trả kết quả.");
}

export type GeminiJobAnalysis = {
  title: string;
  summary: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  rubric: FreeRubricItem[];
  interviewQuestions: string[];
};

export async function analyzeJobWithGemini(input: {
  title: string;
  descriptionRaw: string;
}): Promise<GeminiJobAnalysis> {
  return generateGeminiJson<GeminiJobAnalysis>({
    timeoutMs: 90_000,
    maxOutputTokens: 1800,
    system:
      "Bạn là chuyên gia tuyển dụng. Trả về JSON hợp lệ, không markdown. Không bịa yêu cầu ngoài JD. Trọng số rubric phải tổng đúng 100.",
    prompt: `Phân tích JD sau và trả JSON theo schema: {title:string,summary:string,requiredSkills:string[],niceToHaveSkills:string[],rubric:[{label:string,weight:number,description:string}],interviewQuestions:string[]}.\nTiêu đề: ${input.title}\nJD:\n${clip(input.descriptionRaw, 6000)}`,
  });
}

type GeminiScorePayload = {
  o?: number;
  s?: number;
  t?: number;
  overallScore?: number;
  starOverallScore?: number;
  technicalScore?: number;
};

type GeminiNarrativePayload = {
  str?: unknown;
  imp?: unknown;
  fb?: unknown;
  q?: unknown;
  strengths?: unknown;
  improvements?: unknown;
  feedback?: unknown;
};

type GeminiQuestionEvalPayload = {
  q?: unknown;
};

export type GeminiFieldStatus = "ok" | "missing_rate_limit" | "missing_api" | "heuristic";

function fieldStatusFromError(
  error: GeminiRequestError,
): Exclude<GeminiFieldStatus, "ok" | "heuristic"> {
  return error.httpStatus === 429 ? "missing_rate_limit" : "missing_api";
}

function compactQuestions(questions: Array<{ id: string; prompt: string; category?: string }>) {
  return questions.slice(0, 8).map((question, index) => ({
    id: question.id,
    n: index + 1,
    cat: question.category ?? "",
    q: clip(question.prompt, 180),
  }));
}

function compactAnswers(
  questions: Array<{ id: string }>,
  transcripts: Array<{ questionId?: string | null; speaker: string; text: string }>,
) {
  const byQuestion = new Map<string, string[]>();
  for (const row of transcripts) {
    if (row.speaker !== "candidate") continue;
    const key = row.questionId ?? "_";
    const parts = byQuestion.get(key) ?? [];
    parts.push(clip(row.text, 400));
    byQuestion.set(key, parts);
  }
  const leftover = byQuestion.get("_") ?? [];
  let leftoverUsed = false;
  const answers: Array<{ id: string; a: string }> = [];
  let used = 0;
  for (const question of questions.slice(0, 8)) {
    const tagged = byQuestion.get(question.id) ?? [];
    const parts = tagged.length > 0 ? tagged : !leftoverUsed && leftover.length > 0 ? leftover : [];
    if (parts === leftover) leftoverUsed = true;
    const text = clip(parts.join(" "), 500);
    if (used + text.length > 3200) break;
    answers.push({ id: question.id, a: text });
    used += text.length;
  }
  return answers;
}

function readFeedback(value: unknown): FreeInterviewEvaluation["feedback"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      targetSkill:
        typeof item.sk === "string"
          ? item.sk
          : typeof item.targetSkill === "string"
            ? item.targetSkill
            : "",
      reason:
        typeof item.rs === "string" ? item.rs : typeof item.reason === "string" ? item.reason : "",
      suggestedAction:
        typeof item.ac === "string"
          ? item.ac
          : typeof item.suggestedAction === "string"
            ? item.suggestedAction
            : "",
      severity:
        typeof item.sv === "string"
          ? item.sv
          : typeof item.severity === "string"
            ? item.severity
            : "info",
    }))
    .filter((item) => item.targetSkill && item.reason && item.suggestedAction)
    .slice(0, 6);
}

function optionalScore(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : null;
}

function readQuestionEvals(
  value: unknown,
  questions: Array<{ id: string }>,
): FreeInterviewEvaluation["questionScores"] {
  if (!Array.isArray(value)) return [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  const byIndex = new Map(questions.map((question, index) => [index + 1, question]));
  const seen = new Set<string>();
  const rows: FreeInterviewEvaluation["questionScores"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const fromId = typeof row.id === "string" ? byId.get(row.id) : undefined;
    const index = Number(row.n);
    const question = fromId ?? (Number.isInteger(index) ? byIndex.get(index) : undefined);
    if (!question || seen.has(question.id)) continue;
    const star = optionalScore(row.star ?? row.s);
    const tech = optionalScore(row.tech ?? row.t);
    if (star == null && tech == null) continue;
    const note = typeof row.note === "string" ? clip(row.note, 160) : "";
    const starValue = star ?? tech ?? 0;
    const techValue = tech ?? star ?? 0;
    seen.add(question.id);
    rows.push({
      questionId: question.id,
      technicalScore: techValue,
      situationScore: starValue,
      taskScore: starValue,
      actionScore: starValue,
      resultScore: starValue,
      keyTakeaways: note ? [note] : [],
    });
  }
  return rows;
}

export async function evaluateWithGemini(input: {
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  rubric?: FreeRubricItem[];
  questions: Array<{ id: string; prompt: string; category?: string }>;
  transcripts: Array<{ questionId?: string | null; speaker: string; text: string }>;
  fallback: FreeInterviewEvaluation;
}): Promise<{
  evaluation: FreeInterviewEvaluation;
  provider: string;
  narrativeStatus: GeminiFieldStatus;
  questionEvalStatus: GeminiFieldStatus;
}> {
  if (!isGeminiConfigured() || !geminiProductionAllowed()) {
    return {
      evaluation: input.fallback,
      provider: "free-heuristic-v1",
      narrativeStatus: "heuristic",
      questionEvalStatus: "heuristic",
    };
  }

  const role = clip(input.jobTitle, 120);
  const jd = clip(input.jobDescription, 2500);
  const cv = clip(input.resumeText, 2500);
  const rubric = (input.rubric ?? []).slice(0, 12).map((item) => ({
    label: clip(item.label, 160),
    weight: Number.isFinite(item.weight) ? item.weight : 0,
    description: clip(item.description ?? "", 260),
  }));
  const questions = compactQuestions(input.questions);
  const answers = compactAnswers(input.questions, input.transcripts);
  // REQ-0036 — context is ROLE/JD/CV/Q/A only; visualEvents are not included
  const context = `ROLE: ${role}\nJD: ${jd}\nCV: ${cv}\nRUBRIC: ${JSON.stringify(rubric)}\nQ: ${JSON.stringify(questions)}\nA: ${JSON.stringify(answers)}`;

  const scores = await generateGeminiJson<GeminiScorePayload>({
    timeoutMs: 75_000,
    maxAttempts: 3,
    maxOutputTokens: 160,
    system:
      "Bạn là evaluator interview. Chỉ chấm dựa trên evidence trong A. Trả JSON, không markdown.",
    prompt: `Chấm điểm 0-100. JSON {o:number,s:number,t:number} với o=overall, s=STAR, t=technical. Đối chiếu RUBRIC theo đúng trọng số khi có; không suy đoán năng lực không có trong evidence.\n${context}`,
  });
  const overallScore = scores.o ?? scores.overallScore;
  const starOverallScore = scores.s ?? scores.starOverallScore;
  const technicalScore = scores.t ?? scores.technicalScore;
  if (
    ![overallScore, starOverallScore, technicalScore].every((value) =>
      Number.isFinite(Number(value)),
    )
  ) {
    throw new GeminiRequestError(
      "Gemini trả JSON thiếu điểm o/s/t. Không fallback heuristic khi đã có API key.",
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 8_000));

  let strengths: string[] = [];
  let improvements: string[] = [];
  let feedback: FreeInterviewEvaluation["feedback"] = [];
  let questionScores: FreeInterviewEvaluation["questionScores"] = [];
  let narrativeStatus: GeminiFieldStatus = "missing_api";
  let questionEvalStatus: GeminiFieldStatus = "missing_api";
  let narrativeRateLimited = false;

  try {
    const narrative = await generateGeminiJson<GeminiNarrativePayload>({
      timeoutMs: 75_000,
      maxAttempts: 3,
      maxOutputTokens: 900,
      system:
        "Bạn là evaluator interview. Nhận xét ngắn, chỉ dựa trên evidence. Trả JSON, không markdown.",
      prompt: `Nhận xét + STAR từng câu. JSON {str:string[],imp:string[],fb:[{sk:string,rs:string,ac:string}],q:[{id:string,star:number,tech:number,note:string}]} tối đa 3 str/imp/fb; q đúng số câu, note tối đa 12 từ.\nĐiểm: o=${Number(overallScore)} s=${Number(starOverallScore)} t=${Number(technicalScore)}\n${context}`,
    });
    strengths = asStringArray(narrative.str ?? narrative.strengths, 6);
    improvements = asStringArray(narrative.imp ?? narrative.improvements, 6);
    feedback = readFeedback(narrative.fb ?? narrative.feedback);
    questionScores = readQuestionEvals(narrative.q, input.questions);
    narrativeStatus = "ok";
    if (questionScores.length > 0) questionEvalStatus = "ok";
  } catch (error) {
    if (!(error instanceof GeminiRequestError)) throw error;
    narrativeStatus = fieldStatusFromError(error);
    questionEvalStatus = narrativeStatus;
    narrativeRateLimited = error.httpStatus === 429;
    console.warn("[Gemini] narrative step failed; persisting Gemini scores only", {
      httpStatus: error.httpStatus,
    });
  }

  if (questionEvalStatus !== "ok" && !narrativeRateLimited) {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    try {
      const compact = await generateGeminiJson<GeminiQuestionEvalPayload>({
        timeoutMs: 60_000,
        maxAttempts: 2,
        maxOutputTokens: 420,
        system: "Bạn là evaluator interview. Chỉ chấm dựa trên A. Trả JSON, không markdown.",
        prompt: `STAR từng câu. JSON {q:[{id,star,tech,note}]} star/tech 0-100, note tối đa 12 từ.\n${JSON.stringify({ Q: questions, A: answers })}`,
      });
      questionScores = readQuestionEvals(compact.q, input.questions);
      questionEvalStatus = questionScores.length > 0 ? "ok" : "missing_api";
    } catch (error) {
      if (!(error instanceof GeminiRequestError)) throw error;
      questionEvalStatus = fieldStatusFromError(error);
      console.warn("[Gemini] question-eval step failed; not filling heuristic STAR", {
        httpStatus: error.httpStatus,
      });
    }
  }

  const evaluation: FreeInterviewEvaluation = {
    ...input.fallback,
    overallScore: clamp(overallScore, input.fallback.overallScore),
    starOverallScore: clamp(starOverallScore, input.fallback.starOverallScore),
    technicalScore: clamp(technicalScore, input.fallback.technicalScore),
    visualScore: 0,
    strengths,
    improvements,
    feedback,
    questionScores,
  };
  return { evaluation, provider: geminiProviderLabel(), narrativeStatus, questionEvalStatus };
}

export async function interviewerReplyWithGemini(input: {
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  currentQuestion: string;
  candidateSpeechText: string;
  nextQuestion?: string;
}): Promise<string | null> {
  if (!isGeminiConfigured()) return null;
  const result = await generateGeminiJson<{ reply?: string }>({
    timeoutMs: 8_000,
    maxAttempts: 1,
    maxOutputTokens: 80,
    system:
      "Bạn là người phỏng vấn PivotAssist. Trả JSON {reply:string}. Một câu ngắn tiếng Việt, không đọc lại câu hỏi tiếp theo, không chấm điểm.",
    prompt: `Vị trí: ${clip(input.jobTitle, 80)}\nTin tuyển: ${clip(input.jobDescription, 800)}\nCV: ${clip(input.resumeText, 600)}\nCâu hỏi: ${clip(input.currentQuestion, 200)}\nTrả lời: ${clip(input.candidateSpeechText, 1200)}\nCâu sau (đừng đọc): ${input.nextQuestion ? "còn" : "hết"}`,
  });
  return typeof result.reply === "string" ? result.reply.trim() : null;
}

export async function rewriteBulletWithGemini(input: {
  originalBullet: string;
  jobTitle: string;
  jobDescription: string;
}): Promise<{ rewrittenBullet: string; reasoning: string; keywordsInjected: string[] }> {
  const result = await generateGeminiJson<{
    rewrittenBullet?: string;
    reasoning?: string;
    keywordsInjected?: string[];
  }>({
    timeoutMs: 45_000,
    maxAttempts: 2,
    maxOutputTokens: 280,
    system:
      "Bạn rewrite 1 bullet CV theo JD. Trả JSON {rewrittenBullet, reasoning, keywordsInjected:string[]}. Giữ sự thật; không bịa số liệu.",
    prompt: `JD: ${clip(input.jobTitle, 120)}\n${clip(input.jobDescription, 1800)}\nBullet: ${clip(input.originalBullet, 800)}`,
  });
  if (typeof result.rewrittenBullet !== "string" || result.rewrittenBullet.trim().length < 8) {
    throw new GeminiRequestError("Gemini rewrite không trả rewrittenBullet hợp lệ.");
  }
  return {
    rewrittenBullet: result.rewrittenBullet.trim(),
    reasoning:
      typeof result.reasoning === "string" ? result.reasoning.trim() : "Gemini rewrite theo JD.",
    keywordsInjected: Array.isArray(result.keywordsInjected)
      ? result.keywordsInjected.filter((item) => typeof item === "string")
      : [],
  };
}

function sttModels(): string[] {
  const preferred = process.env.GEMINI_STT_MODEL?.trim();
  return [...new Set([preferred || "gemini-3.5-transcribe", "gemini-3.5-flash-lite"])];
}

function isTranscribeModel(model: string): boolean {
  return /transcribe/i.test(model);
}

/** Một lần gọi mỗi model, timeout ngắn — không retry 429. */
export async function transcribeGeminiAudio(input: {
  bytes: Uint8Array;
  mimeType: string;
  language: "vi" | "en";
}): Promise<string> {
  if (!geminiProductionAllowed()) throw new GeminiNotConfiguredError();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiNotConfiguredError();
  const mimeType = input.mimeType || "audio/webm";
  const data = Buffer.from(input.bytes).toString("base64");
  const prompt =
    input.language === "en"
      ? "Transcribe the speech. Return only the spoken words, no quotes, no commentary."
      : "Chép lời nói. Chỉ trả về câu đã nói, không ngoặc kép, không giải thích.";
  let lastError: GeminiRequestError | null = null;

  for (const model of sttModels()) {
    const started = Date.now();
    const transcribe = isTranscribeModel(model);
    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: transcribe
                  ? [{ inlineData: { mimeType, data } }]
                  : [{ inlineData: { mimeType, data } }, { text: prompt }],
              },
            ],
            generationConfig: transcribe
              ? {
                  audioTranscriptionConfig: {
                    languageCodes: [input.language === "en" ? "en-US" : "vi-VN"],
                    mode: "SMART",
                  },
                }
              : { temperature: 0, maxOutputTokens: 256 },
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      const ms = Date.now() - started;
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const detail = geminiErrorFromBody(payload, response.status);
        lastError = new GeminiRequestError(`Gemini STT HTTP ${response.status}`, response.status);
        console.info("[Gemini STT]", {
          model,
          status: response.status,
          ms,
          errorStatus: detail.statusName ?? null,
        });
        if (response.status === 429 || response.status === 503 || response.status === 404) continue;
        throw lastError;
      }
      const text = textFromResponse(await response.json())
        .replace(/^["“]|["”]$/g, "")
        .trim();
      console.info("[Gemini STT]", { model, status: response.status, ms, chars: text.length });
      if (text) return text;
    } catch (error) {
      if (error instanceof GeminiRequestError) {
        lastError = error;
        continue;
      }
      const ms = Date.now() - started;
      lastError = new GeminiRequestError(
        error instanceof Error ? error.message : "Gemini STT abort",
      );
      console.info("[Gemini STT]", { model, status: "abort", ms });
    }
  }
  if (lastError) throw lastError;
  return "";
}
