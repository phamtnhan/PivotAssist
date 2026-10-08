import { generateGeminiJson, geminiProviderLabel, isGeminiConfigured } from "@/lib/gemini-server";
import {
  analyzeInterviewBlueprint,
  createInitialInterviewState,
  generateNextQuestion,
  runAdaptiveTurn,
  type AdaptivePipelineResult,
  type AdaptiveTurnInput,
  type GeneratedQuestion,
  type InterviewBlueprint,
  type InterviewLanguage,
  type InterviewRubricInput,
  type InterviewState,
} from "@pivotassist/contracts";
import {
  ADAPTIVE_FALLBACK_PROVIDER,
  generateLocalAdaptiveFallback,
  sanitizePromptCopy,
  type AdaptiveTurnInput as LegacyAdaptiveTurnInput,
  type AdaptiveTurnResult as LegacyAdaptiveTurnResult,
} from "./adaptive-interviewer-policy";

export {
  ADAPTIVE_FALLBACK_PROVIDER,
  generateLocalAdaptiveFallback,
  sanitizePromptCopy,
  type LegacyAdaptiveTurnInput as AdaptiveTurnInput,
  type LegacyAdaptiveTurnResult as AdaptiveTurnResult,
};

export interface AdaptiveLiveTurnInput {
  jobTitle: string;
  jobDescription?: string | null;
  resumeText?: string | null;
  rubric?: InterviewRubricInput[];
  difficulty?: string;
  state: InterviewState;
  blueprint?: InterviewBlueprint;
  currentQuestion: AdaptiveTurnInput["currentQuestion"];
  candidateSpeechText: string;
  recentTranscript?: AdaptiveTurnInput["recentTranscript"];
  elapsedTimeMs: number;
  remainingTimeMs?: number;
  language?: InterviewLanguage;
  turnId?: string;
  fallbackQuestions?: Array<{ id: string; prompt: string; category?: string | null }>;
}

export interface AdaptiveLiveTurnResult extends AdaptivePipelineResult {
  mode: "ADAPTIVE" | "FALLBACK";
  provider: string;
  replyAudioText: string;
}

function cleanInline(value: string, limit = 1200): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function isSingleQuestion(value: string): boolean {
  const normalized = value.toLocaleLowerCase();
  // Keep normal live questions within one Google TTS request so one committed
  // assistant turn maps to one generated audio blob and one playback.
  if (value.length < 18 || value.length > 180) return false;
  if (/\b(score|scoring|rubric|điểm|chấm điểm|internal|nội bộ)\b/i.test(normalized)) return false;
  if ((value.match(/[?？]/g) ?? []).length > 1) return false;
  return true;
}

async function generateQuestionFromDirector(input: {
  directive: AdaptivePipelineResult["directive"];
  generated: GeneratedQuestion;
  language: InterviewLanguage;
  targetRole: string;
  jobDescription?: string | null;
  resumeText?: string | null;
  rubric?: InterviewRubricInput[];
}): Promise<string> {
  const english = input.language === "en";
  const system = english
    ? "You are the question generator in an adaptive interview. The director already chose the action and competency. Return only JSON {question:string}. Write one natural question under 180 characters, directly connected to the directive. Do not add acknowledgement, scoring, rubric, or multiple independent questions."
    : "Bạn là Question Generator trong một cuộc phỏng vấn thích ứng. Director đã quyết định action và competency. Chỉ trả JSON {question:string}. Viết đúng một câu hỏi tự nhiên dưới 180 ký tự, bám trực tiếp directive. Không thêm lời cảm ơn, scoring, rubric hoặc nhiều câu hỏi độc lập.";
  const prompt = [
    `Role: ${cleanInline(input.targetRole, 160)}`,
    `Director action: ${input.directive.action}`,
    `Competency: ${cleanInline(input.directive.competency ?? "role competency", 100)}`,
    `Goal: ${cleanInline(input.directive.goal, 260)}`,
    `Difficulty: ${cleanInline(input.directive.difficulty, 40)}`,
    input.jobDescription ? `Relevant JD context: ${cleanInline(input.jobDescription, 500)}` : "",
    input.resumeText ? `Relevant CV context: ${cleanInline(input.resumeText, 500)}` : "",
    input.rubric?.length
      ? `Employer rubric: ${input.rubric.map((item) => `${cleanInline(item.label, 120)}${item.description ? `: ${cleanInline(item.description, 220)}` : ""}`).join(" | ")}`
      : "",
    `Fallback intent: ${cleanInline(input.generated.prompt, 420)}`,
    english
      ? "Write the next interview question in English."
      : "Viết câu hỏi tiếp theo bằng tiếng Việt.",
  ]
    .filter(Boolean)
    .join("\n");
  const result = await generateGeminiJson<{ question?: unknown }>({
    system,
    prompt,
    timeoutMs: 8_000,
    maxAttempts: 1,
    maxOutputTokens: 220,
    thinkingLevel: "MINIMAL",
    fallbackModels: ["gemini-3.5-flash"],
  });
  const question =
    typeof result.question === "string"
      ? sanitizePromptCopy(cleanInline(result.question), english ? "en" : "vi")
      : "";
  if (!isSingleQuestion(question))
    throw new Error("Gemini question generator returned invalid question text");
  return question;
}

/**
 * Runs the explicit evaluator -> state update -> director -> generator chain.
 * The deterministic pipeline remains usable without a provider; Gemini is only
 * allowed to rewrite the already-selected directive into natural language.
 */
export async function generateAdaptiveLiveTurn(
  input: AdaptiveLiveTurnInput,
): Promise<AdaptiveLiveTurnResult> {
  const blueprint =
    input.blueprint ??
    analyzeInterviewBlueprint({
      targetRole: input.jobTitle,
      jobDescription: input.jobDescription,
      resumeText: input.resumeText,
      rubric: input.rubric,
      difficulty: input.difficulty,
    });
  let pipeline: AdaptivePipelineResult;
  try {
    pipeline = runAdaptiveTurn({
      blueprint,
      state: input.state,
      currentQuestion: input.currentQuestion,
      candidateSpeechText: input.candidateSpeechText,
      recentTranscript: input.recentTranscript,
      elapsedTimeMs: input.elapsedTimeMs,
      remainingTimeMs: input.remainingTimeMs,
      language: input.language,
      turnId: input.turnId,
      fallbackQuestions: input.fallbackQuestions,
    });
  } catch (error) {
    console.warn(
      "[AdaptiveInterviewer] Director recovery fallback:",
      error instanceof Error ? error.message : error,
    );
    const recoveryState = createInitialInterviewState(blueprint, {
      maxTurns: input.state.maxTurns,
      remainingTimeMs: input.remainingTimeMs,
    });
    const directive = {
      action: "RECOVER" as const,
      competency: recoveryState.currentCompetency,
      goal: "recover the live interview with one concrete question",
      difficulty: blueprint.difficulty,
      reason: "adaptive state or director evaluation was not available",
      shouldClose: false,
    };
    pipeline = {
      blueprint,
      evaluation: {
        competency: recoveryState.currentCompetency ?? "role_competency",
        answerQuality: "insufficient",
        evidenceStrength: 0,
        claims: [],
        gaps: ["adaptive state recovery required"],
        recommendedActions: ["RECOVER"],
        evidence: [],
        contradictions: [],
        unresolvedQuestions: ["adaptive state recovery required"],
        directExperience: "unknown",
        repeatRequested: false,
        isOffTopic: false,
        isUnusable: true,
        difficultySignal: "weak",
        depthReached: 0,
        answerSummary: cleanInline(input.candidateSpeechText, 240),
      },
      state: {
        ...recoveryState,
        turnNumber: input.state.turnNumber + 1,
        elapsedTimeMs: input.elapsedTimeMs,
      },
      directive,
      nextQuestion: generateNextQuestion({
        directive,
        language: input.language,
        turnNumber: input.state.turnNumber + 1,
        askedPrompts: input.state.askedQuestions.map((item) => item.prompt),
        fallbackQuestions: input.fallbackQuestions,
      }),
    };
  }
  if (!pipeline.nextQuestion || !isGeminiConfigured()) {
    return {
      ...pipeline,
      mode: "FALLBACK",
      provider: ADAPTIVE_FALLBACK_PROVIDER,
      replyAudioText: "",
    };
  }
  try {
    const generatedPrompt = await generateQuestionFromDirector({
      directive: pipeline.directive,
      generated: pipeline.nextQuestion,
      language: input.language ?? "vi",
      targetRole: input.jobTitle,
      jobDescription: input.jobDescription,
      resumeText: input.resumeText,
    });
    return {
      ...pipeline,
      nextQuestion: { ...pipeline.nextQuestion, prompt: generatedPrompt },
      mode: "ADAPTIVE",
      provider: geminiProviderLabel(),
      replyAudioText: "",
    };
  } catch (error) {
    console.warn(
      "[AdaptiveInterviewer] Question generator fallback:",
      error instanceof Error ? error.message : error,
    );
    return {
      ...pipeline,
      mode: "FALLBACK",
      provider: ADAPTIVE_FALLBACK_PROVIDER,
      replyAudioText: "",
    };
  }
}

/** Compatibility wrapper for older callers; normal live flow uses the explicit pipeline above. */
export async function generateAdaptiveTurn(
  input: LegacyAdaptiveTurnInput,
): Promise<LegacyAdaptiveTurnResult> {
  return generateLocalAdaptiveFallback(input);
}
