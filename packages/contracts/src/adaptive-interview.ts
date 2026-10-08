/**
 * Adaptive live interview contract.
 *
 * The question bank is a bounded recovery input only. Normal question
 * selection is driven by the blueprint, the latest evidence, and the
 * director directive returned by this module.
 */

export const ADAPTIVE_MODE = ["ADAPTIVE", "FALLBACK"] as const;
export type AdaptiveMode = (typeof ADAPTIVE_MODE)[number];

export const DIRECTOR_ACTIONS = [
  "FOLLOW_UP",
  "DEEP_DIVE",
  "CLARIFY",
  "CHALLENGE",
  "VERIFY_RESUME_CLAIM",
  "PROBE_JD_GAP",
  "ASK_SCENARIO",
  "SWITCH_COMPETENCY",
  "RECOVER",
  "CLOSE_INTERVIEW",
] as const;
export type DirectorAction = (typeof DIRECTOR_ACTIONS)[number];

export const COVERAGE_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUFFICIENT",
  "INSUFFICIENT",
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const CLAIM_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "PARTIAL",
  "CONTRADICTION",
] as const;
export type ClaimVerificationStatus = (typeof CLAIM_VERIFICATION_STATUSES)[number];

export type AdaptiveDifficulty = "foundation" | "standard" | "advanced" | "expert";

export type InterviewLanguage = "vi" | "en";
export type CompetencySource = "JD" | "CV" | "DERIVED";

export interface InterviewCompetency {
  id: string;
  label: string;
  keywords: string[];
  required: boolean;
  source: CompetencySource;
  requiredEvidence?: number;
  niceToHave?: boolean;
}

export interface ResumeClaim {
  id: string;
  text: string;
  competency: string;
  keywords: string[];
  claim: string;
  sourceFromCV: string;
  relatedJDCompetency: string;
  importance: "low" | "medium" | "high";
  verificationNeeded: boolean;
  verificationStatus: ClaimVerificationStatus;
}

export interface JobGap {
  id: string;
  label: string;
  competency: string;
  keywords: string[];
  critical: boolean;
  sourceFromJD?: string;
  importance?: "low" | "medium" | "high";
  verificationNeeded?: boolean;
}

export interface InterviewBlueprint {
  role: string;
  seniority: string;
  expectedSeniority: string;
  mustHaveCompetencies: string[];
  niceToHaveCompetencies: string[];
  strengthsToValidate: string[];
  competencyWeights: Record<string, number>;
  initialDifficulty: AdaptiveDifficulty;
  interviewTimeBudget: number;
  requiredEvidencePerCompetency: Record<string, number>;
  behavioralAreas: string[];
  technicalAreas: string[];
  initialQuestion: string;
  targetRole: string;
  difficulty: string;
  jdAnalysis: {
    text: string;
    requiredCompetencies: string[];
  };
  cvAnalysis: {
    text: string;
    claims: string[];
  };
  competencies: InterviewCompetency[];
  resumeClaims: ResumeClaim[];
  resumeClaimsToVerify: ResumeClaim[];
  jdGaps: JobGap[];
  jdGapsToProbe: JobGap[];
}

export type InterviewRubricInput = {
  label: string;
  weight?: number;
  description?: string;
};

export interface AskedQuestion {
  questionId: string;
  turnId: string;
  prompt: string;
  competency: string;
  action: DirectorAction | "INITIAL";
}

export interface InterviewTranscriptTurn {
  turnId: string;
  questionId: string | null;
  parentTurnId: string | null;
  speaker: "interviewer" | "candidate";
  timestamp: string;
  sequenceNumber: number;
  text: string;
}

export interface CompetencyCoverage {
  competency: string;
  coverageStatus: CoverageStatus;
  evidenceCount: number;
  evidenceStrength: number;
  confidence: number;
  depthReached: number;
  contradictions: string[];
  unresolvedQuestions: string[];
  evidenceTurnIds: string[];
}

export interface DifficultyChange {
  turnNumber: number;
  from: AdaptiveDifficulty;
  to: AdaptiveDifficulty;
  reason: string;
}

export interface InterviewState {
  schemaVersion: 1;
  currentCompetency: string | null;
  competenciesCovered: string[];
  competencyConfidence: Record<string, number>;
  resumeClaimsVerified: string[];
  resumeClaimsPending: string[];
  jdGapsCovered: string[];
  jdGapsRemaining: string[];
  strengthsObserved: string[];
  concernsObserved: string[];
  askedQuestions: AskedQuestion[];
  transcriptSummary: string;
  recentTurns: InterviewTranscriptTurn[];
  elapsedTimeMs: number;
  remainingTimeMs: number;
  turnNumber: number;
  maxTurns: number;
  currentQuestionId: string | null;
  currentAssistantTurnId: string | null;
  mode: AdaptiveMode;
  lastEvaluation: TurnEvaluation | null;
  coverageByCompetency: Record<string, CompetencyCoverage>;
  resumeClaimStatuses: Record<string, ClaimVerificationStatus>;
  resumeClaimsContradicted: string[];
  currentDifficulty: AdaptiveDifficulty;
  difficultyHistory: DifficultyChange[];
  timeBudgetMinutes: number;
  niceToHaveRemaining: string[];
}

export interface CurrentQuestion {
  id: string;
  prompt: string;
  category?: string | null;
  competency?: string | null;
  assistantTurnId?: string | null;
}

export interface ClaimEvaluation {
  id: string;
  text: string;
  verified: boolean;
  needsProbe: boolean;
  status: ClaimVerificationStatus;
  evidenceStrength: number;
  contradiction: boolean;
}

export interface EvidenceSignal {
  kind:
    | "metric"
    | "architecture"
    | "tradeoff"
    | "action"
    | "outcome"
    | "claim"
    | "scenario"
    | "keyword";
  text: string;
  strength: number;
}

export interface TurnEvaluation {
  competency: string;
  answerQuality: "insufficient" | "partial" | "strong" | "very_strong";
  evidenceStrength: number;
  claims: ClaimEvaluation[];
  gaps: string[];
  recommendedActions: DirectorAction[];
  evidence: EvidenceSignal[];
  contradictions: string[];
  unresolvedQuestions: string[];
  directExperience: "direct" | "partial" | "none" | "unknown";
  repeatRequested: boolean;
  isOffTopic: boolean;
  isUnusable: boolean;
  difficultySignal: "weak" | "solid" | "strong" | "very_strong";
  depthReached: number;
  answerSummary: string;
}

export interface DirectorDirective {
  action: DirectorAction;
  competency: string | null;
  goal: string;
  difficulty: string;
  reason: string;
  shouldClose: boolean;
  difficultyLevel?: AdaptiveDifficulty;
  difficultyChange?: "decrease" | "hold" | "increase";
  coverageStatus?: CoverageStatus;
  evidenceTarget?: string;
}

export interface GeneratedQuestion {
  questionId: string;
  competency: string;
  category: string;
  prompt: string;
  difficulty?: AdaptiveDifficulty;
  evidenceFocus?: string;
}

export interface AdaptiveTurnInput {
  blueprint: InterviewBlueprint;
  state: InterviewState;
  currentQuestion: CurrentQuestion;
  candidateSpeechText: string;
  recentTranscript?: InterviewTranscriptTurn[];
  elapsedTimeMs: number;
  remainingTimeMs?: number;
  language?: InterviewLanguage;
  turnId?: string;
  fallbackQuestions?: Array<{ id: string; prompt: string; category?: string | null }>;
}

export interface AdaptivePipelineResult {
  blueprint: InterviewBlueprint;
  evaluation: TurnEvaluation;
  state: InterviewState;
  directive: DirectorDirective;
  nextQuestion: GeneratedQuestion | null;
}

export interface EvidenceBackedCompetencyReport {
  competency: string;
  score: number | null;
  confidence: number;
  coverageStatus: CoverageStatus;
  evidenceTranscriptRefs: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  unresolvedConcerns: string[];
}

export interface AdaptiveEvidenceReport {
  schemaVersion: 1;
  source: "adaptive-state-v1";
  timeBudgetMinutes: number;
  completedTurns: number;
  competencies: EvidenceBackedCompetencyReport[];
  resumeClaims: Array<{
    id: string;
    claim: string;
    status: ClaimVerificationStatus;
    evidenceTranscriptRefs: string[];
  }>;
  jdGaps: Array<{
    id: string;
    label: string;
    status: "COVERED" | "REMAINING";
    evidenceTranscriptRefs: string[];
  }>;
}

const COMPETENCY_KEYWORDS: Record<string, string[]> = {
  frontend_performance: ["core web vitals", "lcp", "cls", "inp", "web performance", "performance"],
  react_next: ["react", "next.js", "nextjs", "next js"],
  system_design: [
    "system design",
    "architecture",
    "scalability",
    "scale",
    "distributed",
    "reliability",
  ],
  architecture_microfrontend: [
    "microfrontend",
    "micro frontends",
    "module federation",
    "single-spa",
  ],
};

const TECHNICAL_DETAIL_TERMS = [
  "lighthouse",
  "web vitals",
  "p75",
  "field data",
  "lab data",
  "crux",
  "rum",
  "measurement",
  "measure",
  "monitor",
  "preload",
  "lazy-load",
  "lazy load",
  "cdn",
  "cache",
  "module federation",
  "single-spa",
  "trade-off",
  "tradeoff",
  "bottleneck",
  "trade off",
  "trade-offs",
  "tradeoffs",
  "datadog",
  "grafana",
  "architecture",
  "migration",
  "dau",
];

const CONTRADICTION_TERMS = [
  "không tham gia",
  "không trực tiếp",
  "thực ra",
  "không phải em",
  "not involved",
  "wasn't involved",
  "was not involved",
  "didn't lead",
  "did not lead",
];

const NO_EXPERIENCE_TERMS = [
  "chưa từng",
  "chưa có kinh nghiệm",
  "không có kinh nghiệm",
  "không làm",
  "chưa làm",
  "no direct experience",
  "never worked",
  "not directly",
  "haven't done",
];

const OFF_TOPIC_TERMS = [
  "du lịch",
  "thời tiết",
  "món ăn",
  "bóng đá",
  "vacation",
  "weather",
  "recipe",
  "football",
];

const REPEAT_QUESTION_TERMS = [
  "không hiểu",
  "nói lại",
  "nhắc lại",
  "giải thích lại",
  "don't understand",
  "repeat the question",
  "say that again",
];

const DIFFICULTY_ORDER: AdaptiveDifficulty[] = ["foundation", "standard", "advanced", "expert"];

function clean(value: string | null | undefined, limit = 20000): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalized(value: string | null | undefined): string {
  return clean(value).toLocaleLowerCase();
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function normalizeDifficulty(value: string | null | undefined): AdaptiveDifficulty {
  const normalizedValue = normalized(value);
  if (
    normalizedValue.includes("lead") ||
    normalizedValue.includes("principal") ||
    normalizedValue.includes("staff")
  )
    return "expert";
  if (normalizedValue.includes("senior") || normalizedValue.includes("advanced")) return "advanced";
  if (
    normalizedValue.includes("junior") ||
    normalizedValue.includes("entry") ||
    normalizedValue.includes("foundation")
  )
    return "foundation";
  return "standard";
}

function expectedSeniority(value: string | null | undefined): string {
  const normalizedValue = normalized(value);
  if (
    normalizedValue.includes("lead") ||
    normalizedValue.includes("principal") ||
    normalizedValue.includes("staff")
  )
    return "lead";
  if (normalizedValue.includes("senior") || normalizedValue.includes("sr")) return "senior";
  if (
    normalizedValue.includes("junior") ||
    normalizedValue.includes("entry") ||
    normalizedValue.includes("fresher")
  )
    return "junior";
  return "mid";
}

function difficultyAt(value: AdaptiveDifficulty, delta: number): AdaptiveDifficulty {
  const index = DIFFICULTY_ORDER.indexOf(value);
  return (
    DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, index + delta))] ??
    "standard"
  );
}

function difficultyLabel(value: AdaptiveDifficulty, language: InterviewLanguage = "vi"): string {
  if (language === "en") return value;
  return (
    {
      foundation: "nền tảng",
      standard: "tiêu chuẩn",
      advanced: "nâng cao",
      expert: "chuyên sâu",
    } satisfies Record<AdaptiveDifficulty, string>
  )[value];
}

function normalizeCoverage(
  coverage: Partial<CompetencyCoverage> | undefined,
  competency: string,
): CompetencyCoverage {
  return {
    competency,
    coverageStatus: coverage?.coverageStatus ?? "NOT_STARTED",
    evidenceCount: Math.max(0, coverage?.evidenceCount ?? 0),
    evidenceStrength: clamp(coverage?.evidenceStrength ?? 0),
    confidence: clamp(coverage?.confidence ?? 0),
    depthReached: Math.max(0, coverage?.depthReached ?? 0),
    contradictions: unique(coverage?.contradictions ?? []),
    unresolvedQuestions: unique(coverage?.unresolvedQuestions ?? []),
    evidenceTurnIds: unique(coverage?.evidenceTurnIds ?? []),
  };
}

function answerHasPersonalOwnership(answer: string): boolean {
  return /\b(i|we|my|our|em|tôi|mình|team em|nhóm tôi|đã trực tiếp|led|owned|implemented|designed|built|measured)\b/i.test(
    answer,
  );
}

function answerMentionsTechnicalEvidence(answer: string): boolean {
  return TECHNICAL_DETAIL_TERMS.some((term) => answer.includes(term));
}

function competencyLabel(id: string): string {
  const labels: Record<string, string> = {
    frontend_performance: "frontend performance",
    react_next: "React và Next.js",
    system_design: "system design",
    architecture_microfrontend: "kiến trúc microfrontend",
    role_competency: "năng lực cốt lõi của vị trí",
  };
  return labels[id] ?? id.replace(/_/g, " ");
}

function categoryForCompetency(competency: string): string {
  if (competency === "system_design" || competency === "architecture_microfrontend")
    return "system_design";
  if (competency === "frontend_performance" || competency === "react_next") return "technical";
  return "behavioral";
}

function claimMatches(
  claim: ResumeClaim,
  question: string,
  answer: string,
  competency: string,
): boolean {
  const corpus = `${question} ${answer}`;
  return claim.competency === competency || includesAny(corpus, claim.keywords);
}

export function analyzeInterviewBlueprint(input: {
  targetRole: string;
  jobDescription?: string | null;
  resumeText?: string | null;
  rubric?: InterviewRubricInput[];
  difficulty?: string;
  interviewTimeBudgetMinutes?: number;
}): InterviewBlueprint {
  const rubricText = (input.rubric ?? [])
    .filter((item) => item && typeof item.label === "string" && item.label.trim())
    .slice(0, 12)
    .map(
      (item) =>
        `${clean(item.label, 160)}${item.description ? `: ${clean(item.description, 320)}` : ""}`,
    )
    .join("\n");
  const jdText = clean(
    [input.jobDescription ?? "", rubricText ? `Employer interview rubric:\n${rubricText}` : ""]
      .filter(Boolean)
      .join("\n"),
    12000,
  );
  const cvText = clean(input.resumeText, 12000);
  const jd = normalized(jdText);
  const cv = normalized(cvText);
  const competencies: InterviewCompetency[] = [];
  const optionalSection = /(?:nice\s+to\s+have|bonus|preferred|optional|plus)/i.test(jdText);
  const addCompetency = (id: string, source: CompetencySource, required = true) => {
    if (competencies.some((item) => item.id === id)) return;
    competencies.push({
      id,
      label: competencyLabel(id),
      keywords: COMPETENCY_KEYWORDS[id] ?? [id],
      required,
      source,
      requiredEvidence: required ? 2 : 1,
      niceToHave: !required,
    });
  };

  if (includesAny(jd, ["core web vitals", "lcp", "cls", "inp", "web performance", "performance"])) {
    addCompetency("frontend_performance", "JD");
  }
  if (includesAny(jd, ["react", "next.js", "nextjs", "next js"])) addCompetency("react_next", "JD");
  if (
    includesAny(jd, ["system design", "architecture", "scalability", "distributed", "reliability"])
  ) {
    addCompetency("system_design", "JD");
  }
  if (includesAny(jd, ["microfrontend", "micro frontends", "module federation", "single-spa"])) {
    addCompetency("architecture_microfrontend", "JD");
  } else if (
    competencies.some((item) => item.id === "system_design") &&
    !includesAny(cv, COMPETENCY_KEYWORDS.architecture_microfrontend)
  ) {
    // Senior system-design roles have an architecture boundary to validate even
    // when the JD does not spell out one vendor or framework.
    addCompetency("architecture_microfrontend", "DERIVED");
  }
  if (optionalSection && includesAny(jd, ["accessibility", "a11y"]))
    addCompetency("accessibility", "JD", false);
  if (optionalSection && includesAny(jd, ["graphql"])) addCompetency("graphql", "JD", false);
  if (optionalSection && includesAny(jd, ["testing", "test automation", "playwright", "cypress"]))
    addCompetency("testing", "JD", false);
  if (competencies.length === 0) addCompetency("role_competency", "JD");

  const resumeClaims: ResumeClaim[] = [];
  const addClaim = (
    claim: Omit<
      ResumeClaim,
      | "claim"
      | "sourceFromCV"
      | "relatedJDCompetency"
      | "importance"
      | "verificationNeeded"
      | "verificationStatus"
    > & {
      sourceFromCV?: string;
      importance?: "low" | "medium" | "high";
    },
  ) => {
    resumeClaims.push({
      ...claim,
      claim: claim.text,
      sourceFromCV: claim.sourceFromCV ?? cvText.slice(0, 240),
      relatedJDCompetency: claim.competency,
      importance: claim.importance ?? "high",
      verificationNeeded: true,
      verificationStatus: "PENDING",
    });
  };
  if (
    /(?:lcp|largest contentful paint)[^\n]{0,80}(?:4\s*(?:s|sec|giây)|4\.0)[^\n]{0,50}(?:2\s*(?:s|sec|giây)|2\.0)/i.test(
      cvText,
    ) ||
    /4\s*(?:s|sec|giây)\s*(?:→|->|to|xuống|đến)\s*2/i.test(cvText)
  ) {
    addClaim({
      id: "lcp_4s_to_2s",
      text: "Reduced LCP from 4s to 2s",
      competency: "frontend_performance",
      keywords: ["lcp", "largest contentful paint", "4s", "4 sec", "2s", "2 sec"],
    });
  }
  if (/(?:100\s*k|100,?000|100000)[^\n]{0,40}(?:users|người dùng|người sử dụng)/i.test(cvText)) {
    addClaim({
      id: "ecommerce_100k_users",
      text: "Ecommerce serving 100k users",
      competency: "system_design",
      keywords: ["100k", "100000", "100,000", "users", "người dùng", "ecommerce"],
    });
  }
  if (
    /(?:led|dẫn dắt|lead|chủ trì)[^\n]{0,80}(?:migration|migrat(?:e|ion)|chuyển đổi)[^\n]{0,100}(?:100\s*k|100,?000|100000)\s*(?:dau|daily active users|người dùng hoạt động)/i.test(
      cvText,
    )
  ) {
    addClaim({
      id: "migration_100k_dau",
      text: "Led migration serving 100k DAU",
      competency: "system_design",
      keywords: ["migration", "migrated", "100k dau", "100000 dau", "daily active users"],
      importance: "high",
    });
  }
  if (
    /(?:3|three)\s*(?:years?|năm)[^\n]{0,20}react/i.test(cvText) ||
    /react[^\n]{0,20}(?:3|three)\s*(?:years?|năm)/i.test(cvText)
  ) {
    addClaim({
      id: "react_three_years",
      text: "Three years of React experience",
      competency: "react_next",
      keywords: ["react", "3 years", "3 năm"],
    });
  }

  const jdGaps: JobGap[] = [];
  const addGap = (
    id: string,
    label: string,
    competency: string,
    keywords: string[],
    critical = true,
  ) => {
    if (!jdGaps.some((item) => item.id === id))
      jdGaps.push({
        id,
        label,
        competency,
        keywords,
        critical,
        sourceFromJD: jdText.slice(0, 240),
        importance: critical ? "high" : "medium",
        verificationNeeded: true,
      });
  };
  for (const competency of competencies) {
    if (
      competency.id === "architecture_microfrontend" &&
      !includesAny(cv, COMPETENCY_KEYWORDS.architecture_microfrontend)
    ) {
      addGap(
        "architecture_microfrontend",
        "microfrontend architecture",
        competency.id,
        COMPETENCY_KEYWORDS.architecture_microfrontend,
      );
    } else if (
      competency.id !== "architecture_microfrontend" &&
      competency.source === "JD" &&
      !includesAny(cv, competency.keywords)
    ) {
      addGap(
        `${competency.id}_evidence`,
        `${competency.label} evidence`,
        competency.id,
        competency.keywords,
        false,
      );
    }
  }

  const mustHaveCompetencies = competencies.filter((item) => item.required).map((item) => item.id);
  const niceToHaveCompetencies = competencies
    .filter((item) => !item.required)
    .map((item) => item.id);
  const rawWeights = Object.fromEntries(
    competencies.map((item) => [item.id, item.required ? 1 : 0.5]),
  );
  const totalWeight = Object.values(rawWeights).reduce((sum, value) => sum + value, 0) || 1;
  const competencyWeights = Object.fromEntries(
    Object.entries(rawWeights).map(([id, value]) => [id, Number((value / totalWeight).toFixed(4))]),
  );
  const requiredEvidencePerCompetency = Object.fromEntries(
    competencies.map((item) => [item.id, item.requiredEvidence ?? (item.required ? 2 : 1)]),
  );
  const strengthsToValidate = unique([
    ...resumeClaims.map((claim) => claim.text),
    ...competencies.filter((item) => item.source === "CV").map((item) => item.label),
  ]);
  const role = clean(input.targetRole, 180) || "professional role";
  const seniority = expectedSeniority(`${input.targetRole} ${jdText} ${input.difficulty ?? ""}`);
  const interviewTimeBudget = Math.min(
    30,
    Math.max(10, Math.round(input.interviewTimeBudgetMinutes ?? 20)),
  );
  const result: InterviewBlueprint = {
    role,
    seniority,
    expectedSeniority: seniority,
    mustHaveCompetencies,
    niceToHaveCompetencies,
    strengthsToValidate,
    competencyWeights,
    initialDifficulty: normalizeDifficulty(input.difficulty ?? `${seniority}`),
    interviewTimeBudget,
    requiredEvidencePerCompetency,
    behavioralAreas: ["ownership", "communication", "trade-offs"],
    technicalAreas: competencies.filter((item) => item.required).map((item) => item.label),
    initialQuestion: "",
    targetRole: role,
    difficulty: clean(input.difficulty, 30) || seniority,
    jdAnalysis: {
      text: jdText,
      requiredCompetencies: competencies.filter((item) => item.required).map((item) => item.id),
    },
    cvAnalysis: { text: cvText, claims: resumeClaims.map((claim) => claim.text) },
    competencies,
    resumeClaims,
    resumeClaimsToVerify: resumeClaims,
    jdGaps,
    jdGapsToProbe: jdGaps,
  };
  // This is a seed only. Live question selection remains Director/state driven.
  result.initialQuestion = generateInitialQuestion(result, "vi").prompt;
  return result;
}

export function createInitialInterviewState(
  blueprint: InterviewBlueprint,
  options: { remainingTimeMs?: number; maxTurns?: number } = {},
): InterviewState {
  const competencies = blueprint.competencies ?? [];
  const resumeClaims = blueprint.resumeClaims ?? [];
  const niceToHaveCompetencies =
    blueprint.niceToHaveCompetencies ??
    competencies.filter((item) => !item.required).map((item) => item.id);
  const timeBudgetMinutes = Math.min(
    30,
    Math.max(10, Math.round(blueprint.interviewTimeBudget ?? 20)),
  );
  const initialDifficulty =
    blueprint.initialDifficulty ?? normalizeDifficulty(blueprint.difficulty);
  const initialCompetency =
    resumeClaims.find((claim) => claim.competency === "frontend_performance")?.competency ??
    competencies[0]?.id ??
    "role_competency";
  const coverageByCompetency = Object.fromEntries(
    competencies.map((competency) => [competency.id, normalizeCoverage(undefined, competency.id)]),
  );
  const resumeClaimStatuses = Object.fromEntries(
    resumeClaims.map((claim) => [claim.id, claim.verificationStatus ?? "PENDING"]),
  );
  const remainingTimeMs = Math.max(0, options.remainingTimeMs ?? timeBudgetMinutes * 60_000);
  return {
    schemaVersion: 1,
    currentCompetency: initialCompetency,
    competenciesCovered: [],
    competencyConfidence: {},
    resumeClaimsVerified: [],
    resumeClaimsPending: resumeClaims.map((claim) => claim.id),
    jdGapsCovered: [],
    jdGapsRemaining: (blueprint.jdGaps ?? []).map((gap) => gap.id),
    strengthsObserved: [],
    concernsObserved: [],
    askedQuestions: [],
    transcriptSummary: "",
    recentTurns: [],
    elapsedTimeMs: 0,
    remainingTimeMs,
    turnNumber: 0,
    maxTurns: Math.max(1, options.maxTurns ?? 20),
    currentQuestionId: null,
    currentAssistantTurnId: null,
    mode: "ADAPTIVE",
    lastEvaluation: null,
    coverageByCompetency,
    resumeClaimStatuses,
    resumeClaimsContradicted: [],
    currentDifficulty: initialDifficulty,
    difficultyHistory: [],
    timeBudgetMinutes,
    niceToHaveRemaining: [...niceToHaveCompetencies],
  };
}

/**
 * Makes persisted C0 adaptive snapshots forward-compatible with the richer
 * coverage/difficulty state. Old snapshots remain valid data, but the live
 * director always receives the complete state shape.
 */
export function normalizeInterviewState(
  state: InterviewState,
  blueprint: InterviewBlueprint,
): InterviewState {
  const legacy = state as Partial<InterviewState>;
  const base = createInitialInterviewState(blueprint, {
    remainingTimeMs:
      typeof legacy.remainingTimeMs === "number"
        ? legacy.remainingTimeMs
        : blueprint.interviewTimeBudget * 60_000,
    maxTurns: typeof legacy.maxTurns === "number" ? legacy.maxTurns : 20,
  });
  const coverageByCompetency: Record<string, CompetencyCoverage> = {};
  for (const competency of blueprint.competencies) {
    const existing = legacy.coverageByCompetency?.[competency.id];
    const legacyConfidence = legacy.competencyConfidence?.[competency.id] ?? 0;
    const legacyCovered = legacy.competenciesCovered?.includes(competency.id) ?? false;
    coverageByCompetency[competency.id] = normalizeCoverage(existing, competency.id);
    if (!existing && legacyCovered) {
      coverageByCompetency[competency.id] = {
        ...coverageByCompetency[competency.id],
        coverageStatus: "SUFFICIENT",
        evidenceCount: 1,
        evidenceStrength: legacyConfidence,
        confidence: legacyConfidence,
      };
    }
  }
  const resumeClaimStatuses = {
    ...base.resumeClaimStatuses,
    ...(legacy.resumeClaimStatuses ?? {}),
  };
  for (const id of legacy.resumeClaimsVerified ?? []) resumeClaimStatuses[id] = "VERIFIED";
  for (const id of legacy.resumeClaimsContradicted ?? []) resumeClaimStatuses[id] = "CONTRADICTION";
  return {
    ...base,
    ...state,
    coverageByCompetency,
    resumeClaimStatuses,
    resumeClaimsContradicted: unique(legacy.resumeClaimsContradicted ?? []),
    currentDifficulty: legacy.currentDifficulty ?? blueprint.initialDifficulty,
    difficultyHistory: legacy.difficultyHistory ?? [],
    timeBudgetMinutes: legacy.timeBudgetMinutes ?? blueprint.interviewTimeBudget,
    niceToHaveRemaining: legacy.niceToHaveRemaining ?? [...blueprint.niceToHaveCompetencies],
  };
}

export function generateInitialQuestion(
  blueprint: InterviewBlueprint,
  language: InterviewLanguage = "vi",
): GeneratedQuestion {
  const isEnglish = language === "en";
  const lcp = blueprint.resumeClaims.find((claim) => claim.id === "lcp_4s_to_2s");
  if (lcp) {
    return {
      questionId: "initial:lcp_4s_to_2s",
      competency: "frontend_performance",
      category: "technical",
      prompt: isEnglish
        ? "Your CV says you reduced LCP from 4 seconds to 2 seconds. How did you measure it, and what changes made the biggest difference?"
        : "CV của bạn ghi đã giảm LCP từ 4 giây xuống 2 giây. Bạn đo lường thế nào và thay đổi nào tạo ra khác biệt lớn nhất?",
    };
  }
  const claim = blueprint.resumeClaims[0];
  if (claim) {
    return {
      questionId: `initial:${claim.id}`,
      competency: claim.competency,
      category: categoryForCompetency(claim.competency),
      prompt: isEnglish
        ? `Could you walk me through the result described in your CV: ${claim.text}?`
        : `Bạn có thể trình bày cụ thể kết quả được ghi trong CV: ${claim.text} không?`,
    };
  }
  const competency = blueprint.competencies[0] ?? {
    id: "role_competency",
    label: "năng lực cốt lõi",
    keywords: [],
    required: true,
    source: "JD" as const,
  };
  return {
    questionId: "initial:blueprint",
    competency: competency.id,
    category: categoryForCompetency(competency.id),
    prompt: isEnglish
      ? `What is the most relevant project you have delivered for ${competency.label}, and what was your personal contribution?`
      : `Bạn hãy chia sẻ dự án phù hợp nhất với ${competency.label} và phần đóng góp trực tiếp của bạn.`,
  };
}

function legacyEvaluateTurn(input: {
  blueprint: InterviewBlueprint;
  state: InterviewState;
  currentQuestion: CurrentQuestion;
  candidateSpeechText: string;
}): TurnEvaluation {
  const answer = clean(input.candidateSpeechText);
  const answerLower = normalized(answer);
  const questionLower = normalized(input.currentQuestion.prompt);
  const competency =
    input.currentQuestion.competency ?? input.state.currentCompetency ?? "role_competency";
  const words = answer.split(/\s+/).filter(Boolean);
  const detailCount = TECHNICAL_DETAIL_TERMS.filter((term) => answerLower.includes(term)).length;
  const hasMetric = /\d/.test(answer);
  const quality: TurnEvaluation["answerQuality"] =
    words.length < 7
      ? "insufficient"
      : detailCount + (hasMetric ? 1 : 0) >= 3
        ? "strong"
        : "partial";
  const claims: ClaimEvaluation[] = input.blueprint.resumeClaims
    .filter((claim) => claimMatches(claim, questionLower, answerLower, competency))
    .map((claim) => {
      const relevantDetail =
        detailCount > 0 ||
        includesAny(answerLower, [
          "đo",
          "đo lường",
          "công cụ",
          "tool",
          "method",
          "methodology",
          "test",
          "kiểm thử",
        ]);
      const directMetric =
        claim.id === "lcp_4s_to_2s" &&
        /(?:4\s*(?:s|sec|giây)|4\.0)[^\n]{0,80}(?:2\s*(?:s|sec|giây)|2\.0)/i.test(answer);
      const verified = (quality === "strong" && relevantDetail) || (directMetric && relevantDetail);
      return {
        id: claim.id,
        text: claim.text,
        verified,
        needsProbe: !verified,
        status: verified ? "VERIFIED" : "PENDING",
        evidenceStrength: verified ? 0.84 : 0.2,
        contradiction: false,
      };
    });
  const gaps: string[] = [];
  if (
    competency === "frontend_performance" &&
    claims.some((claim) => claim.id === "lcp_4s_to_2s" && claim.needsProbe)
  ) {
    gaps.push("measurement methodology unclear");
  }
  if (
    competency === "architecture_microfrontend" &&
    !includesAny(answerLower, COMPETENCY_KEYWORDS.architecture_microfrontend)
  ) {
    gaps.push("microfrontend experience not demonstrated");
  }
  if (
    competency === "system_design" &&
    !includesAny(answerLower, [
      "boundary",
      "service",
      "queue",
      "cache",
      "database",
      "scaling",
      "scale",
      "architecture",
      "module",
    ])
  ) {
    gaps.push("architecture trade-offs not demonstrated");
  }
  if (quality === "insufficient") gaps.push("role, action, and outcome remain unclear");

  const evidenceStrength = clamp(
    claims.some((claim) => claim.verified)
      ? 0.84
      : quality === "strong"
        ? 0.72
        : quality === "partial"
          ? Math.min(0.62, 0.34 + detailCount * 0.08 + (hasMetric ? 0.08 : 0))
          : 0.22,
  );
  const recommendedActions: DirectorAction[] = [];
  if (claims.some((claim) => claim.needsProbe)) recommendedActions.push("VERIFY_RESUME_CLAIM");
  if (competency === "architecture_microfrontend" && gaps.length > 0)
    recommendedActions.push("PROBE_JD_GAP");
  if (quality === "insufficient") recommendedActions.push("FOLLOW_UP");
  if (recommendedActions.length === 0)
    recommendedActions.push(evidenceStrength >= 0.7 ? "SWITCH_COMPETENCY" : "DEEP_DIVE");

  return {
    competency,
    answerQuality: quality,
    evidenceStrength,
    claims,
    gaps: unique(gaps),
    recommendedActions: unique(recommendedActions) as DirectorAction[],
    evidence: [],
    contradictions: [],
    unresolvedQuestions: unique(gaps),
    directExperience: "unknown",
    repeatRequested: false,
    isOffTopic: false,
    isUnusable: words.length === 0,
    difficultySignal: quality === "strong" ? "strong" : quality === "partial" ? "solid" : "weak",
    depthReached: detailCount,
    answerSummary: answer.slice(0, 240),
  };
}

export function evaluateTurn(input: {
  blueprint: InterviewBlueprint;
  state: InterviewState;
  currentQuestion: CurrentQuestion;
  candidateSpeechText: string;
}): TurnEvaluation {
  const answer = clean(input.candidateSpeechText);
  const answerLower = normalized(answer);
  const questionLower = normalized(input.currentQuestion.prompt);
  const competency =
    input.currentQuestion.competency ?? input.state.currentCompetency ?? "role_competency";
  const competencyKeywords = COMPETENCY_KEYWORDS[competency] ?? [competency.replace(/_/g, " ")];
  const words = answer.split(/\s+/).filter(Boolean);
  const detailCount = TECHNICAL_DETAIL_TERMS.filter((term) => answerLower.includes(term)).length;
  const hasMetric = /\d/.test(answer);
  const hasOwnership = answerHasPersonalOwnership(answerLower);
  const explicitNoExperience = includesAny(answerLower, NO_EXPERIENCE_TERMS);
  const contradictionDetected = includesAny(answerLower, CONTRADICTION_TERMS);
  const repeatRequest = includesAny(answerLower, REPEAT_QUESTION_TERMS);
  const hasRelevantKeyword =
    includesAny(answerLower, competencyKeywords) || answerMentionsTechnicalEvidence(answerLower);
  const isUnusable =
    words.length === 0 || /^(?:\[?inaudible\]?|\.\.\.|uh+|um+|啊+|ờ+)$/i.test(answerLower);
  const isOffTopic =
    !isUnusable &&
    (includesAny(answerLower, OFF_TOPIC_TERMS) ||
      (words.length >= 8 && !hasRelevantKeyword && !hasOwnership && !hasMetric));
  const directExperience: TurnEvaluation["directExperience"] = explicitNoExperience
    ? "none"
    : /(?:team\s+(?:em|tôi)|nhóm\s+(?:em|tôi)|we\s+did|our\s+team)/i.test(answer) &&
        !/(?:em|tôi|i)\s+(?:đã|trực tiếp|designed|led|built|implemented|measured)/i.test(answer)
      ? "partial"
      : hasOwnership
        ? "direct"
        : "unknown";
  const teamOnly = directExperience === "partial";
  const quality: TurnEvaluation["answerQuality"] =
    isUnusable || isOffTopic || words.length < 7
      ? "insufficient"
      : detailCount >= 5 && hasMetric && directExperience === "direct" && words.length >= 20
        ? "very_strong"
        : detailCount + (hasMetric ? 1 : 0) >= 3 ||
            (directExperience === "direct" && words.length >= 18)
          ? "strong"
          : "partial";
  const difficultySignal: TurnEvaluation["difficultySignal"] =
    quality === "very_strong"
      ? "very_strong"
      : quality === "strong"
        ? "strong"
        : quality === "partial"
          ? "solid"
          : "weak";

  const evidence: EvidenceSignal[] = [];
  if (hasMetric)
    evidence.push({
      kind: "metric",
      text: "candidate supplied a measurable quantity",
      strength: 0.7,
    });
  if (hasOwnership)
    evidence.push({
      kind: "action",
      text: "candidate described personal ownership",
      strength: 0.65,
    });
  if (answerMentionsTechnicalEvidence(answerLower))
    evidence.push({
      kind: "keyword",
      text: "candidate supplied technical evidence or tooling",
      strength: 0.65,
    });
  if (
    includesAny(answerLower, [
      "trade-off",
      "tradeoff",
      "đánh đổi",
      "failure",
      "sự cố",
      "bottleneck",
      "nút thắt",
    ])
  )
    evidence.push({
      kind: "tradeoff",
      text: "candidate discussed trade-offs or failure modes",
      strength: 0.8,
    });
  if (
    includesAny(answerLower, [
      "architecture",
      "kiến trúc",
      "boundary",
      "service",
      "queue",
      "cache",
      "database",
      "scale",
      "scaling",
    ])
  )
    evidence.push({
      kind: "architecture",
      text: "candidate discussed architecture or system scale",
      strength: 0.78,
    });
  if (
    includesAny(answerLower, [
      "result",
      "kết quả",
      "outcome",
      "giảm",
      "tăng",
      "reduced",
      "improved",
    ])
  )
    evidence.push({ kind: "outcome", text: "candidate described an outcome", strength: 0.65 });
  if (includesAny(answerLower, ["scenario", "giả sử", "nếu phải", "imagine", "would"]))
    evidence.push({ kind: "scenario", text: "candidate engaged with a scenario", strength: 0.6 });

  const claims: ClaimEvaluation[] = input.blueprint.resumeClaims
    .filter((claim) => claimMatches(claim, questionLower, answerLower, competency))
    .map((claim) => {
      const claimContradiction =
        contradictionDetected || (claim.id === "migration_100k_dau" && explicitNoExperience);
      const directMetric =
        claim.id === "lcp_4s_to_2s"
          ? /(?:4\s*(?:s|sec|giây)|4\.0)[^\n]{0,80}(?:2\s*(?:s|sec|giây)|2\.0)/i.test(answer)
          : claim.id === "migration_100k_dau"
            ? /(?:migration|migrat|chuyển đổi)[^\n]{0,100}(?:100\s*k|100,?000|100000)[^\n]{0,30}(?:dau|daily active|người dùng)/i.test(
                answer,
              )
            : hasMetric;
      const claimStrong =
        !claimContradiction &&
        directExperience === "direct" &&
        (quality === "strong" || quality === "very_strong") &&
        (directMetric || detailCount >= 2 || evidence.length >= 2);
      const claimPartial =
        !claimContradiction &&
        (teamOnly || (quality === "partial" && (hasMetric || hasRelevantKeyword)));
      const status: ClaimVerificationStatus = claimContradiction
        ? "CONTRADICTION"
        : claimStrong
          ? "VERIFIED"
          : claimPartial
            ? "PARTIAL"
            : "PENDING";
      const claimStrength =
        status === "VERIFIED"
          ? quality === "very_strong"
            ? 0.96
            : 0.86
          : status === "PARTIAL"
            ? 0.45
            : status === "CONTRADICTION"
              ? 0.08
              : 0.2;
      return {
        id: claim.id,
        text: claim.text,
        verified: status === "VERIFIED",
        needsProbe: status !== "VERIFIED",
        status,
        evidenceStrength: claimStrength,
        contradiction: status === "CONTRADICTION",
      };
    });
  if (claims.some((claim) => claim.status === "VERIFIED"))
    evidence.push({
      kind: "claim",
      text: "resume claim supported by answer evidence",
      strength: 0.9,
    });

  const gaps: string[] = [];
  if (
    competency === "frontend_performance" &&
    claims.some((claim) => claim.id === "lcp_4s_to_2s" && claim.status !== "VERIFIED")
  )
    gaps.push("measurement methodology unclear");
  if (
    competency === "architecture_microfrontend" &&
    !includesAny(answerLower, COMPETENCY_KEYWORDS.architecture_microfrontend)
  )
    gaps.push("microfrontend experience not demonstrated");
  if (
    competency === "system_design" &&
    !includesAny(answerLower, [
      "boundary",
      "service",
      "queue",
      "cache",
      "database",
      "scaling",
      "scale",
      "architecture",
      "module",
      "migration",
    ])
  )
    gaps.push("architecture trade-offs not demonstrated");
  if (quality === "insufficient" && !isOffTopic && !repeatRequest)
    gaps.push("role, action, and outcome remain unclear");
  if (explicitNoExperience) gaps.push("direct experience not demonstrated");
  if (repeatRequest) gaps.push("candidate requested clarification or repetition");
  if (isOffTopic) gaps.push("answer is off-topic for the current competency");
  if (contradictionDetected) gaps.push("candidate contradicted a prior claim");
  const contradictions = unique([
    ...(contradictionDetected
      ? ["candidate explicitly withdrew or contradicted ownership of a prior claim"]
      : []),
    ...claims
      .filter((claim) => claim.contradiction)
      .map((claim) => `resume claim contradicted: ${claim.text}`),
  ]);
  const evidenceStrength = clamp(
    claims.some((claim) => claim.status === "VERIFIED")
      ? Math.max(
          ...claims
            .filter((claim) => claim.status === "VERIFIED")
            .map((claim) => claim.evidenceStrength),
        )
      : quality === "very_strong"
        ? 0.9
        : quality === "strong"
          ? 0.76
          : quality === "partial"
            ? Math.min(0.6, 0.34 + detailCount * 0.07 + (hasMetric ? 0.1 : 0))
            : explicitNoExperience
              ? 0.35
              : 0.18,
  );
  const recommendedActions: DirectorAction[] = [];
  if (isUnusable || isOffTopic) recommendedActions.push("RECOVER");
  else if (contradictions.length > 0) recommendedActions.push("CHALLENGE");
  else if (claims.some((claim) => claim.status === "PENDING" || claim.status === "PARTIAL"))
    recommendedActions.push("VERIFY_RESUME_CLAIM");
  else if (repeatRequest) recommendedActions.push("CLARIFY");
  else if (explicitNoExperience) recommendedActions.push("ASK_SCENARIO");
  else if (quality === "insufficient") recommendedActions.push("CLARIFY");
  else if (quality === "strong" || quality === "very_strong") recommendedActions.push("DEEP_DIVE");
  else recommendedActions.push("FOLLOW_UP");

  return {
    competency,
    answerQuality: quality,
    evidenceStrength,
    claims,
    gaps: unique(gaps),
    recommendedActions: unique(recommendedActions) as DirectorAction[],
    evidence,
    contradictions,
    unresolvedQuestions: unique([
      ...gaps,
      ...claims.filter((claim) => claim.needsProbe).map((claim) => `verify ${claim.text}`),
    ]),
    directExperience,
    repeatRequested: repeatRequest,
    isOffTopic,
    isUnusable,
    difficultySignal,
    depthReached: Math.min(
      4,
      Math.max(
        0,
        Math.floor(detailCount / 2) + (evidence.some((item) => item.kind === "tradeoff") ? 1 : 0),
      ),
    ),
    answerSummary: answer.slice(0, 240),
  };
}

export function updateInterviewState(input: {
  state: InterviewState;
  blueprint?: InterviewBlueprint;
  evaluation: TurnEvaluation;
  recentTurns?: InterviewTranscriptTurn[];
  evidenceTurnId?: string;
  elapsedTimeMs: number;
  remainingTimeMs?: number;
}): InterviewState {
  const state = input.blueprint
    ? normalizeInterviewState(input.state, input.blueprint)
    : input.state;
  const confidence = { ...state.competencyConfidence };
  const priorCoverage = normalizeCoverage(
    state.coverageByCompetency?.[input.evaluation.competency],
    input.evaluation.competency,
  );
  const requiredEvidence =
    input.blueprint?.requiredEvidencePerCompetency?.[input.evaluation.competency] ?? 2;
  const evidenceTurnId =
    input.evidenceTurnId ?? input.recentTurns?.at(-1)?.turnId ?? `turn-${state.turnNumber + 1}`;
  const coverageEvidenceCount = priorCoverage.evidenceCount + 1;
  const coverageEvidenceStrength = Math.max(
    priorCoverage.evidenceStrength,
    input.evaluation.evidenceStrength,
  );
  const coverageConfidence = clamp(
    priorCoverage.confidence * 0.45 + input.evaluation.evidenceStrength * 0.55,
  );
  const coverageContradictions = unique([
    ...priorCoverage.contradictions,
    ...input.evaluation.contradictions,
  ]);
  const unresolvedQuestions = unique(input.evaluation.unresolvedQuestions);
  const coverageStatus: CoverageStatus =
    coverageContradictions.length > 0
      ? "INSUFFICIENT"
      : ((coverageEvidenceCount >= requiredEvidence && coverageEvidenceStrength >= 0.62) ||
            (input.evaluation.evidenceStrength >= 0.78 &&
              input.evaluation.answerQuality !== "insufficient")) &&
          unresolvedQuestions.length === 0
        ? "SUFFICIENT"
        : coverageEvidenceCount === 0
          ? "NOT_STARTED"
          : "IN_PROGRESS";
  const coverageByCompetency = {
    ...(state.coverageByCompetency ?? {}),
    [input.evaluation.competency]: {
      competency: input.evaluation.competency,
      coverageStatus,
      evidenceCount: coverageEvidenceCount,
      evidenceStrength: coverageEvidenceStrength,
      confidence: coverageConfidence,
      depthReached: Math.max(priorCoverage.depthReached, input.evaluation.depthReached),
      contradictions: coverageContradictions,
      unresolvedQuestions,
      evidenceTurnIds: unique([...priorCoverage.evidenceTurnIds, evidenceTurnId]),
    },
  } satisfies Record<string, CompetencyCoverage>;
  confidence[input.evaluation.competency] = coverageConfidence;
  const covered = Object.values(coverageByCompetency)
    .filter((item) => item.coverageStatus === "SUFFICIENT")
    .map((item) => item.competency);
  const verifiedClaims = unique([
    ...state.resumeClaimsVerified,
    ...input.evaluation.claims.filter((claim) => claim.verified).map((claim) => claim.id),
  ]);
  const claimStatuses = { ...(state.resumeClaimStatuses ?? {}) };
  for (const claim of input.evaluation.claims) claimStatuses[claim.id] = claim.status;
  const contradictedClaims = unique([
    ...(state.resumeClaimsContradicted ?? []),
    ...input.evaluation.claims.filter((claim) => claim.contradiction).map((claim) => claim.id),
  ]);
  const pendingClaims = Object.entries(claimStatuses)
    .filter(([, status]) => status === "PENDING" || status === "PARTIAL")
    .map(([id]) => id);
  const resolvedGapIds = new Set<string>();
  if (coverageStatus === "SUFFICIENT")
    resolvedGapIds.add(`${input.evaluation.competency}_evidence`);
  if (
    input.evaluation.competency === "architecture_microfrontend" &&
    (input.evaluation.gaps.length === 0 ||
      (input.evaluation.evidenceStrength >= 0.62 &&
        input.evaluation.evidence.some((item) => item.kind === "scenario")))
  )
    resolvedGapIds.add("architecture_microfrontend");
  const currentGap = state.jdGapsRemaining.filter((id) => !resolvedGapIds.has(id));
  const recent = [...(input.recentTurns ?? input.state.recentTurns)].slice(-8);
  const summary = recent
    .filter((turn) => turn.speaker === "candidate")
    .slice(-3)
    .map((turn) => clean(turn.text, 240))
    .join(" | ");
  const currentDifficulty =
    state.currentDifficulty ?? input.blueprint?.initialDifficulty ?? "standard";
  const difficultyTarget =
    input.evaluation.difficultySignal === "very_strong"
      ? difficultyAt(currentDifficulty, 2)
      : input.evaluation.difficultySignal === "strong"
        ? difficultyAt(currentDifficulty, 1)
        : input.evaluation.difficultySignal === "weak"
          ? difficultyAt(currentDifficulty, -1)
          : currentDifficulty;
  const difficultyHistory =
    difficultyTarget === currentDifficulty
      ? state.difficultyHistory
      : [
          ...(state.difficultyHistory ?? []),
          {
            turnNumber: state.turnNumber + 1,
            from: currentDifficulty,
            to: difficultyTarget,
            reason: input.evaluation.difficultySignal,
          },
        ];
  return {
    ...state,
    competenciesCovered: covered,
    competencyConfidence: confidence,
    resumeClaimsVerified: verifiedClaims,
    resumeClaimsPending: pendingClaims,
    resumeClaimStatuses: claimStatuses,
    resumeClaimsContradicted: contradictedClaims,
    jdGapsRemaining: currentGap,
    jdGapsCovered: unique([
      ...state.jdGapsCovered,
      ...state.jdGapsRemaining.filter((id) => !currentGap.includes(id)),
    ]),
    strengthsObserved:
      input.evaluation.evidenceStrength >= 0.7
        ? unique([
            ...state.strengthsObserved,
            ...input.evaluation.evidence.map((item) => item.text),
            `${competencyLabel(input.evaluation.competency)} evidence`,
          ])
        : state.strengthsObserved,
    concernsObserved: unique([
      ...state.concernsObserved,
      ...input.evaluation.gaps,
      ...input.evaluation.contradictions,
    ]),
    transcriptSummary: summary,
    recentTurns: recent,
    elapsedTimeMs: Math.max(0, input.elapsedTimeMs),
    remainingTimeMs: Math.max(0, input.remainingTimeMs ?? state.remainingTimeMs),
    turnNumber: state.turnNumber + 1,
    lastEvaluation: input.evaluation,
    coverageByCompetency,
    currentDifficulty: difficultyTarget,
    difficultyHistory,
    niceToHaveRemaining: (
      input.blueprint?.niceToHaveCompetencies ?? state.niceToHaveRemaining
    ).filter((id) => coverageByCompetency[id]?.coverageStatus !== "SUFFICIENT"),
  };
}

function nextUncoveredCompetency(
  blueprint: InterviewBlueprint,
  state: InterviewState,
): string | null {
  const requiredIds =
    blueprint.mustHaveCompetencies?.length > 0
      ? blueprint.mustHaveCompetencies
      : blueprint.competencies.filter((item) => item.required).map((item) => item.id);
  return (
    requiredIds.find((id) => state.coverageByCompetency?.[id]?.coverageStatus !== "SUFFICIENT") ??
    null
  );
}

export function decideNextAction(input: {
  blueprint: InterviewBlueprint;
  state: InterviewState;
  recentTranscript: InterviewTranscriptTurn[];
  lastEvaluation: TurnEvaluation;
  remainingTimeMs: number;
}): DirectorDirective {
  const { blueprint, state, lastEvaluation } = input;
  const currentDifficulty =
    state.currentDifficulty ??
    blueprint.initialDifficulty ??
    normalizeDifficulty(blueprint.difficulty);
  const difficultyHistory = state.difficultyHistory ?? [];
  const lastDifficultyChange = difficultyHistory.at(-1);
  const difficultyChange: DirectorDirective["difficultyChange"] =
    lastDifficultyChange?.turnNumber === state.turnNumber
      ? lastDifficultyChange.to === lastDifficultyChange.from
        ? "hold"
        : DIFFICULTY_ORDER.indexOf(lastDifficultyChange.to) >
            DIFFICULTY_ORDER.indexOf(lastDifficultyChange.from)
          ? "increase"
          : "decrease"
      : "hold";
  const difficulty = currentDifficulty;
  const currentCoverage = normalizeCoverage(
    state.coverageByCompetency?.[lastEvaluation.competency],
    lastEvaluation.competency,
  );
  const requiredCompetencies =
    blueprint.mustHaveCompetencies?.length > 0
      ? blueprint.mustHaveCompetencies
      : blueprint.competencies.filter((item) => item.required).map((item) => item.id);
  const nextCompetency = nextUncoveredCompetency(blueprint, state);
  const nextNiceToHave =
    (blueprint.niceToHaveCompetencies ?? []).find(
      (id) => state.coverageByCompetency?.[id]?.coverageStatus !== "SUFFICIENT",
    ) ?? null;
  const pendingClaims = (blueprint.resumeClaims ?? []).filter((claim) => {
    const status =
      state.resumeClaimStatuses?.[claim.id] ??
      (state.resumeClaimsPending.includes(claim.id) ? "PENDING" : claim.verificationStatus);
    return status === "PENDING" || status === "PARTIAL";
  });
  const remainingTimeMs = Math.max(0, input.remainingTimeMs);
  const budgetMs = Math.max(
    10 * 60_000,
    (state.timeBudgetMinutes || blueprint.interviewTimeBudget || 20) * 60_000,
  );
  const lowTime = remainingTimeMs <= Math.max(120_000, Math.round(budgetMs * 0.2));
  const closeBoundary = remainingTimeMs <= 15_000;
  const allRequiredCovered = requiredCompetencies.every(
    (id) => state.coverageByCompetency?.[id]?.coverageStatus === "SUFFICIENT",
  );
  const unresolvedGap = blueprint.jdGaps.find(
    (item) =>
      state.jdGapsRemaining.includes(item.id) &&
      (item.critical || requiredCompetencies.includes(item.competency)),
  );
  const currentGap = blueprint.jdGaps.find(
    (item) =>
      item.competency === lastEvaluation.competency && state.jdGapsRemaining.includes(item.id),
  );
  const make = (
    action: DirectorAction,
    competency: string | null,
    goal: string,
    reason: string,
    evidenceTarget?: string,
  ): DirectorDirective => ({
    action,
    competency,
    goal,
    difficulty,
    reason,
    shouldClose: action === "CLOSE_INTERVIEW",
    difficultyLevel: currentDifficulty,
    difficultyChange,
    coverageStatus: currentCoverage.coverageStatus,
    evidenceTarget,
  });

  // Turn limits are only a safety boundary. Coverage and evidence below are
  // the normal termination policy.
  if (state.turnNumber >= state.maxTurns || closeBoundary) {
    return make(
      "CLOSE_INTERVIEW",
      state.currentCompetency,
      "close naturally before the interview boundary",
      "time or safety boundary reached",
    );
  }
  if (lastEvaluation.repeatRequested) {
    return make(
      "CLARIFY",
      lastEvaluation.competency,
      "make the current question understandable without changing the competency",
      "candidate asked for the question to be repeated or explained",
      lastEvaluation.unresolvedQuestions[0],
    );
  }
  if (lastEvaluation.isUnusable || lastEvaluation.isOffTopic) {
    return make(
      "RECOVER",
      lastEvaluation.competency,
      "recover the conversation with one short, concrete prompt",
      "the latest speech cannot be used as evidence for the current competency",
    );
  }
  if (
    lastEvaluation.contradictions.length > 0 ||
    lastEvaluation.claims.some((claim) => claim.contradiction)
  ) {
    const contradiction =
      lastEvaluation.contradictions[0] ?? "a resume claim changed during the answer";
    return make(
      "CHALLENGE",
      lastEvaluation.competency,
      `resolve the contradiction: ${contradiction}`,
      "the latest answer conflicts with a prior claim or ownership statement",
      contradiction,
    );
  }
  if (
    lastEvaluation.claims.some((claim) => claim.status === "PENDING" || claim.status === "PARTIAL")
  ) {
    const claim = lastEvaluation.claims.find(
      (item) => item.status === "PENDING" || item.status === "PARTIAL",
    );
    return make(
      "VERIFY_RESUME_CLAIM",
      lastEvaluation.competency,
      `verify the resume claim: ${claim?.text ?? "candidate claim"}`,
      "the answer mentioned a claim without enough direct evidence",
      claim?.text,
    );
  }
  if (lastEvaluation.directExperience === "none" && currentGap) {
    return make(
      "ASK_SCENARIO",
      lastEvaluation.competency,
      `test transferable reasoning for ${currentGap.label}`,
      "candidate has no direct experience, so the gap must be tested with a scenario rather than treated as an automatic failure",
      currentGap.label,
    );
  }

  // In the final part of the budget, required competencies win and optional
  // competencies are dropped. Do not spend the remaining window on another
  // deep dive when one compact coverage move is still possible.
  if (lowTime) {
    if (nextCompetency && nextCompetency !== lastEvaluation.competency) {
      return make(
        "SWITCH_COMPETENCY",
        nextCompetency,
        `cover the remaining must-have competency: ${competencyLabel(nextCompetency)}`,
        "low remaining time prioritizes a must-have competency over a nice-to-have or prolonged deep dive",
        competencyLabel(nextCompetency),
      );
    }
    if (!allRequiredCovered) {
      return make(
        "FOLLOW_UP",
        lastEvaluation.competency,
        "obtain one concise piece of evidence for the current must-have competency",
        "low remaining time allows one focused evidence follow-up only",
        lastEvaluation.unresolvedQuestions[0] ?? "one concrete action and outcome",
      );
    }
    return make(
      "CLOSE_INTERVIEW",
      state.currentCompetency,
      "close after covering the must-have competencies",
      "low remaining time drops nice-to-have exploration",
    );
  }

  if (currentCoverage.coverageStatus !== "SUFFICIENT") {
    if (lastEvaluation.answerQuality === "insufficient") {
      return make(
        "FOLLOW_UP",
        lastEvaluation.competency,
        "obtain one concrete situation, personal action, and outcome",
        "the answer is too vague to establish competency evidence",
        lastEvaluation.unresolvedQuestions[0] ?? "situation, action, outcome",
      );
    }
    if (
      lastEvaluation.answerQuality === "very_strong" ||
      lastEvaluation.answerQuality === "strong"
    ) {
      const target =
        currentDifficulty === "expert" || currentDifficulty === "advanced"
          ? "trade-offs, failure modes, and system impact"
          : "the measurement or design decision behind the result";
      return make(
        "DEEP_DIVE",
        lastEvaluation.competency,
        `deepen ${competencyLabel(lastEvaluation.competency)} at ${difficulty} difficulty`,
        "strong evidence earns a harder depth probe before coverage is marked sufficient",
        target,
      );
    }
    return make(
      "FOLLOW_UP",
      lastEvaluation.competency,
      `complete the evidence for ${competencyLabel(lastEvaluation.competency)}`,
      "partial evidence needs one relevant follow-up before switching",
    );
  }

  if (nextCompetency && nextCompetency !== lastEvaluation.competency) {
    return make(
      "SWITCH_COMPETENCY",
      nextCompetency,
      `switch to ${competencyLabel(nextCompetency)}`,
      "current competency is sufficient and another must-have competency remains uncovered",
      competencyLabel(nextCompetency),
    );
  }
  if (unresolvedGap) {
    if (unresolvedGap.competency !== lastEvaluation.competency && !allRequiredCovered) {
      return make(
        "SWITCH_COMPETENCY",
        unresolvedGap.competency,
        `switch to the uncovered JD gap: ${unresolvedGap.label}`,
        "coverage tracking selected the next required gap",
        unresolvedGap.label,
      );
    }
    return make(
      "PROBE_JD_GAP",
      unresolvedGap.competency,
      `probe the JD gap: ${unresolvedGap.label}`,
      "the job requires evidence that the CV and current transcript have not supplied",
      unresolvedGap.label,
    );
  }
  if (pendingClaims.length > 0) {
    const claim = pendingClaims[0];
    return make(
      "VERIFY_RESUME_CLAIM",
      claim.relatedJDCompetency,
      `verify the remaining resume claim: ${claim.text}`,
      "required evidence remains for a material resume claim",
      claim.text,
    );
  }
  if (nextNiceToHave) {
    return make(
      "SWITCH_COMPETENCY",
      nextNiceToHave,
      `sample the optional competency: ${competencyLabel(nextNiceToHave)}`,
      "must-have coverage is complete and time remains for a nice-to-have signal",
      competencyLabel(nextNiceToHave),
    );
  }
  if (allRequiredCovered && state.jdGapsRemaining.length === 0 && pendingClaims.length === 0) {
    return make(
      "CLOSE_INTERVIEW",
      state.currentCompetency,
      "close after evidence-backed coverage is complete",
      "all must-have competencies, claims, and JD gaps are resolved",
    );
  }
  return make(
    "FOLLOW_UP",
    lastEvaluation.competency,
    "collect the next concrete evidence signal",
    "the director could not safely switch or close from the current state",
  );
}

function promptForDirective(input: {
  directive: DirectorDirective;
  language: InterviewLanguage;
  claimText?: string;
  targetRole?: string;
  state?: InterviewState;
  evaluation?: TurnEvaluation;
  turnNumber?: number;
  fallbackQuestions?: Array<{ id: string; prompt: string; category?: string | null }>;
}): GeneratedQuestion | null {
  if (input.directive.shouldClose || input.directive.action === "CLOSE_INTERVIEW") return null;
  const en = input.language === "en";
  const competency = input.directive.competency ?? "role_competency";
  const claim = input.claimText;
  const answerAnchor = clean(input.evaluation?.answerSummary, 52).replace(/[?!.]+/g, "");
  const evidenceFocus = clean(
    input.directive.evidenceTarget ??
      input.evaluation?.unresolvedQuestions[0] ??
      input.evaluation?.evidence.at(-1)?.text ??
      "one concrete decision",
    72,
  );
  const depthPrompt =
    input.directive.difficultyLevel === "expert" || input.directive.difficultyLevel === "advanced"
      ? en
        ? "trade-offs and failure modes"
        : "đánh đổi và tình huống thất bại"
      : en
        ? "the decision and its measurement"
        : "quyết định và cách đo lường";
  let prompt: string;
  switch (input.directive.action) {
    case "VERIFY_RESUME_CLAIM":
      prompt = en
        ? `You mentioned “${answerAnchor || claim || "that result"}”. How did you verify ${claim ?? "it"}, including the tool and baseline?`
        : `Bạn vừa nói “${answerAnchor || claim || "kết quả đó"}”. Bạn xác minh ${claim ?? "điều này"} bằng công cụ và mốc đo nào?`;
      break;
    case "PROBE_JD_GAP":
      prompt = en
        ? `For ${competencyLabel(competency)}, how would you set boundaries and manage shared dependencies for independent releases?`
        : `Với ${competencyLabel(competency)}, bạn chia boundary và quản lý dependency dùng chung thế nào để release độc lập?`;
      break;
    case "SWITCH_COMPETENCY":
      prompt = en
        ? `Let's move to ${competencyLabel(competency)}. What decision did you personally make, and what evidence shows it worked?`
        : `Chúng ta chuyển sang ${competencyLabel(competency)}. Bạn đã trực tiếp quyết định gì, và bằng chứng nào cho thấy quyết định đó hiệu quả?`;
      break;
    case "ASK_SCENARIO":
      if (competency === "architecture_microfrontend") {
        prompt = en
          ? `You have not used microfrontends directly. Imagine a migration: how would you set frontend boundaries, deploy safely, and manage trade-offs?`
          : `Bạn chưa làm microfrontend trực tiếp. Hãy giả sử cần migration: bạn chia boundary frontend, deploy an toàn và xử lý đánh đổi thế nào?`;
      } else {
        prompt = en
          ? `Imagine a production scenario for ${competencyLabel(competency)}. What would you inspect first and why?`
          : `Hãy giả sử một tình huống production về ${competencyLabel(competency)}. Bạn kiểm tra gì trước và vì sao?`;
      }
      break;
    case "CLARIFY":
      prompt = en
        ? `Let me rephrase: could you give one concrete example of ${competencyLabel(competency)} and your personal contribution?`
        : `Mình diễn đạt lại nhé: bạn nêu một ví dụ cụ thể về ${competencyLabel(competency)} và phần bạn trực tiếp làm được không?`;
      break;
    case "CHALLENGE":
      prompt = en
        ? `Your account changed around “${answerAnchor || "that claim"}”. Which part should we trust, and what evidence can resolve it?`
        : `Thông tin về “${answerAnchor || "claim đó"}” đã thay đổi. Phần nào chính xác và bằng chứng nào giúp làm rõ?`;
      break;
    case "RECOVER":
      prompt = en
        ? `Let's return to ${competencyLabel(competency)}. What did you personally do in one concrete example?`
        : `Mình quay lại ${competencyLabel(competency)} nhé. Trong một ví dụ cụ thể, bạn đã trực tiếp làm gì?`;
      break;
    case "FOLLOW_UP":
      prompt = en
        ? `You mentioned “${answerAnchor || evidenceFocus}”. What was your specific action and the observable outcome?`
        : `Bạn vừa nói “${answerAnchor || evidenceFocus}”. Hành động cụ thể của bạn và kết quả quan sát được là gì?`;
      break;
    case "DEEP_DIVE":
      prompt = en
        ? `Go deeper on ${competencyLabel(competency)}: based on “${answerAnchor || evidenceFocus}”, explain ${depthPrompt}.`
        : `Đi sâu hơn về ${competencyLabel(competency)}: từ “${answerAnchor || evidenceFocus}”, hãy giải thích ${depthPrompt}.`;
      break;
    default:
      prompt = en
        ? `Could you give one concrete evidence signal for ${competencyLabel(competency)}?`
        : `Bạn có thể nêu một bằng chứng cụ thể cho ${competencyLabel(competency)} không?`;
      break;
  }
  // Normal questions stay below the single-request TTS limit. The question
  // generator is intentionally short; long context belongs in state/evidence.
  const normalizedPrompt = clean(prompt, 180);
  const fallback = input.fallbackQuestions?.find(
    (item) => clean(item.prompt) && clean(item.prompt) !== normalizedPrompt,
  );
  const signatureSource = `${input.turnNumber ?? 0}|${competency}|${input.directive.action}|${answerAnchor}|${evidenceFocus}`;
  const signature = [...signatureSource]
    .reduce((sum, character) => (sum * 33 + character.charCodeAt(0)) >>> 0, 7)
    .toString(16);
  return {
    questionId: `adaptive:${competency}:${input.directive.action}:${input.turnNumber ?? 0}:${signature}`,
    competency,
    category: categoryForCompetency(competency),
    prompt:
      normalizedPrompt ||
      fallback?.prompt ||
      (en ? "Could you give one concrete example?" : "Bạn có thể nêu một ví dụ cụ thể không?"),
    difficulty: input.directive.difficultyLevel,
    evidenceFocus,
  };
}

/** Question generation consumes the director directive; it does not select strategy. */
export function generateNextQuestion(input: {
  directive: DirectorDirective;
  language?: InterviewLanguage;
  claimText?: string;
  targetRole?: string;
  state?: InterviewState;
  evaluation?: TurnEvaluation;
  turnNumber?: number;
  askedPrompts?: string[];
  fallbackQuestions?: Array<{ id: string; prompt: string; category?: string | null }>;
}): GeneratedQuestion | null {
  const result = promptForDirective({ ...input, language: input.language ?? "vi" });
  if (!result) return null;
  const asked = new Set((input.askedPrompts ?? []).map((item) => normalized(item)));
  if (!asked.has(normalized(result.prompt))) return result;
  const suffix =
    input.language === "en"
      ? " Please anchor it in one specific project."
      : " Bạn hãy gắn với một dự án cụ thể.";
  return { ...result, prompt: clean(`${result.prompt.replace(/[?!.]+$/, "")}${suffix}`, 180) };
}

export function runAdaptiveTurn(input: AdaptiveTurnInput): AdaptivePipelineResult {
  const evaluation = evaluateTurn({
    blueprint: input.blueprint,
    state: input.state,
    currentQuestion: input.currentQuestion,
    candidateSpeechText: input.candidateSpeechText,
  });
  const state = updateInterviewState({
    state: input.state,
    blueprint: input.blueprint,
    evaluation,
    recentTurns: input.recentTranscript,
    evidenceTurnId: input.turnId,
    elapsedTimeMs: input.elapsedTimeMs,
    remainingTimeMs: input.remainingTimeMs,
  });
  const directive = decideNextAction({
    blueprint: input.blueprint,
    state,
    recentTranscript: input.recentTranscript ?? state.recentTurns,
    lastEvaluation: evaluation,
    remainingTimeMs: state.remainingTimeMs,
  });
  const nextState = {
    ...state,
    currentCompetency: directive.competency ?? state.currentCompetency,
  };
  const claimText = evaluation.claims.find((claim) => claim.needsProbe)?.text;
  const nextQuestion = generateNextQuestion({
    directive,
    language: input.language,
    claimText,
    targetRole: input.blueprint.targetRole,
    state: nextState,
    evaluation,
    turnNumber: nextState.turnNumber,
    askedPrompts: nextState.askedQuestions.map((item) => item.prompt),
    fallbackQuestions: input.fallbackQuestions,
  });
  return { blueprint: input.blueprint, evaluation, state: nextState, directive, nextQuestion };
}

/**
 * Builds the POST artifact from state and stable transcript references. A
 * competency without an evidence reference deliberately receives a null
 * score; the report never invents a numeric score from blueprint presence.
 */
export function buildAdaptiveEvidenceReport(input: {
  blueprint: InterviewBlueprint;
  state: InterviewState;
  transcript?: InterviewTranscriptTurn[];
}): AdaptiveEvidenceReport {
  const transcriptIds = new Set((input.transcript ?? []).map((turn) => turn.turnId));
  const competencyEntries = input.blueprint.competencies.map((competency) => {
    const coverage = normalizeCoverage(
      input.state.coverageByCompetency?.[competency.id],
      competency.id,
    );
    const evidenceTranscriptRefs = coverage.evidenceTurnIds.filter(
      (id) => transcriptIds.size === 0 || transcriptIds.has(id),
    );
    const hasEvidence = evidenceTranscriptRefs.length > 0 && coverage.evidenceCount > 0;
    const latest =
      input.state.lastEvaluation?.competency === competency.id ? input.state.lastEvaluation : null;
    const positiveSignals = unique([
      ...(latest?.evidence ?? []).filter((item) => item.strength >= 0.6).map((item) => item.text),
      ...(coverage.evidenceStrength >= 0.62
        ? [`evidence strength ${(coverage.evidenceStrength * 100).toFixed(0)}%`]
        : []),
    ]);
    const negativeSignals = unique([
      ...coverage.contradictions,
      ...(coverage.evidenceStrength < 0.62 && hasEvidence ? ["evidence remains partial"] : []),
    ]);
    const unresolvedConcerns = unique([...coverage.unresolvedQuestions, ...(latest?.gaps ?? [])]);
    const rawScore = coverage.evidenceStrength * 0.6 + coverage.confidence * 0.4;
    const score = hasEvidence ? Math.round(clamp(rawScore) * 10) : null;
    return {
      competency: competency.id,
      score,
      confidence: coverage.confidence,
      coverageStatus: coverage.coverageStatus,
      evidenceTranscriptRefs,
      positiveSignals,
      negativeSignals,
      unresolvedConcerns,
    } satisfies EvidenceBackedCompetencyReport;
  });
  const claimRefs = new Map<string, string[]>();
  for (const competency of competencyEntries) {
    for (const claim of input.blueprint.resumeClaims.filter(
      (item) => item.competency === competency.competency,
    )) {
      claimRefs.set(claim.id, competency.evidenceTranscriptRefs);
    }
  }
  const resumeClaims = input.blueprint.resumeClaims.map((claim) => ({
    id: claim.id,
    claim: claim.claim,
    status: input.state.resumeClaimStatuses?.[claim.id] ?? claim.verificationStatus,
    evidenceTranscriptRefs: claimRefs.get(claim.id) ?? [],
  }));
  const jdGaps = input.blueprint.jdGaps.map((gap) => {
    const competency = competencyEntries.find((item) => item.competency === gap.competency);
    return {
      id: gap.id,
      label: gap.label,
      status: input.state.jdGapsRemaining.includes(gap.id)
        ? ("REMAINING" as const)
        : ("COVERED" as const),
      evidenceTranscriptRefs: competency?.evidenceTranscriptRefs ?? [],
    };
  });
  return {
    schemaVersion: 1,
    source: "adaptive-state-v1",
    timeBudgetMinutes: input.state.timeBudgetMinutes ?? input.blueprint.interviewTimeBudget,
    completedTurns: input.state.turnNumber,
    competencies: competencyEntries,
    resumeClaims,
    jdGaps,
  };
}

export const director = { decideNextAction };
export const questionGenerator = { generateNextQuestion };
