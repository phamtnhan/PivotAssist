import assert from "node:assert/strict";
import test from "node:test";
import {
  DIRECTOR_ACTIONS,
  analyzeInterviewBlueprint,
  buildAdaptiveEvidenceReport,
  createInitialInterviewState,
  decideNextAction,
  generateInitialQuestion,
  generateNextQuestion,
  runAdaptiveTurn,
  type AdaptivePipelineResult,
  type InterviewBlueprint,
  type InterviewState,
  type InterviewTranscriptTurn,
} from "../../../../packages/contracts/src/adaptive-interview.ts";

const JOB_DESCRIPTION = [
  "Senior Frontend Engineer. Must have React, Next.js, Core Web Vitals, system design, and microfrontend architecture.",
  "Nice to have: accessibility and GraphQL.",
].join(" ");
const RESUME = [
  "3 years React and Next.js. Reduced LCP from 4s to 2s.",
  "Ecommerce platform serving 100k users. Led migration serving 100k DAU.",
].join(" ");

type BranchSession = {
  name: string;
  blueprint: InterviewBlueprint;
  state: InterviewState;
  currentQuestion: { id: string; prompt: string; competency: string };
  transcript: InterviewTranscriptTurn[];
  results: AdaptivePipelineResult[];
};

function blueprint(timeBudgetMinutes = 20) {
  return analyzeInterviewBlueprint({
    targetRole: "Senior Frontend Engineer",
    jobDescription: JOB_DESCRIPTION,
    resumeText: RESUME,
    difficulty: "senior",
    interviewTimeBudgetMinutes: timeBudgetMinutes,
  });
}

function startBranch(name: string, timeBudgetMinutes = 20): BranchSession {
  const currentBlueprint = blueprint(timeBudgetMinutes);
  const initialQuestion = generateInitialQuestion(currentBlueprint, "vi");
  const state = createInitialInterviewState(currentBlueprint, {
    remainingTimeMs: timeBudgetMinutes * 60_000,
    maxTurns: 40,
  });
  const questionId = `${name}:question:0`;
  const assistantTurnId = `${name}:assistant:0`;
  return {
    name,
    blueprint: currentBlueprint,
    state: {
      ...state,
      currentQuestionId: questionId,
      currentAssistantTurnId: assistantTurnId,
      askedQuestions: [
        {
          questionId,
          turnId: assistantTurnId,
          prompt: initialQuestion.prompt,
          competency: initialQuestion.competency,
          action: "INITIAL",
        },
      ],
    },
    currentQuestion: {
      id: questionId,
      prompt: initialQuestion.prompt,
      competency: initialQuestion.competency,
    },
    transcript: [
      {
        turnId: assistantTurnId,
        questionId,
        parentTurnId: null,
        speaker: "interviewer",
        timestamp: new Date(0).toISOString(),
        sequenceNumber: 1,
        text: initialQuestion.prompt,
      },
    ],
    results: [],
  };
}

function answerBranch(
  session: BranchSession,
  answer: string,
  elapsedMs: number,
): AdaptivePipelineResult {
  const turnNumber = session.results.length + 1;
  const turnId = `${session.name}:candidate:${turnNumber}`;
  const result = runAdaptiveTurn({
    blueprint: session.blueprint,
    state: session.state,
    currentQuestion: session.currentQuestion,
    candidateSpeechText: answer,
    recentTranscript: session.transcript.slice(-8),
    elapsedTimeMs: elapsedMs,
    remainingTimeMs: session.blueprint.interviewTimeBudget * 60_000 - elapsedMs,
    language: "vi",
    turnId,
  });
  session.results.push(result);
  session.transcript.push({
    turnId,
    questionId: session.currentQuestion.id,
    parentTurnId: session.state.currentAssistantTurnId,
    speaker: "candidate",
    timestamp: new Date(elapsedMs).toISOString(),
    sequenceNumber: session.transcript.length + 1,
    text: answer,
  });
  if (result.nextQuestion) {
    const questionId = `${session.name}:question:${turnNumber}`;
    session.transcript.push({
      turnId,
      questionId,
      parentTurnId: turnId,
      speaker: "interviewer",
      timestamp: new Date(elapsedMs + 1).toISOString(),
      sequenceNumber: session.transcript.length + 1,
      text: result.nextQuestion.prompt,
    });
    session.state = {
      ...result.state,
      currentCompetency: result.nextQuestion.competency,
      currentQuestionId: questionId,
      currentAssistantTurnId: turnId,
      askedQuestions: [
        ...result.state.askedQuestions,
        {
          questionId,
          turnId,
          prompt: result.nextQuestion.prompt,
          competency: result.nextQuestion.competency,
          action: result.directive.action,
        },
      ],
      recentTurns: session.transcript.slice(-8),
    };
    session.currentQuestion = {
      id: questionId,
      prompt: result.nextQuestion.prompt,
      competency: result.nextQuestion.competency,
    };
  } else {
    session.state = { ...result.state, recentTurns: session.transcript.slice(-8) };
  }
  return result;
}

function stateAtCompetency(
  currentBlueprint: InterviewBlueprint,
  competency: string,
): InterviewState {
  const state = createInitialInterviewState(currentBlueprint, {
    remainingTimeMs: currentBlueprint.interviewTimeBudget * 60_000,
    maxTurns: 40,
  });
  return {
    ...state,
    currentCompetency: competency,
    currentQuestionId: "manual-question",
    currentAssistantTurnId: "manual-assistant",
  };
}

test("PREP creates a CV × JD blueprint with claims, gaps, weights, and evidence targets", () => {
  const currentBlueprint = blueprint();
  assert.equal(currentBlueprint.role, "Senior Frontend Engineer");
  assert.equal(currentBlueprint.seniority, "senior");
  assert.equal(currentBlueprint.expectedSeniority, "senior");
  assert.ok(currentBlueprint.mustHaveCompetencies.includes("architecture_microfrontend"));
  assert.ok(currentBlueprint.niceToHaveCompetencies.includes("accessibility"));
  assert.ok(currentBlueprint.strengthsToValidate.some((item) => /LCP|migration/i.test(item)));
  assert.equal(currentBlueprint.initialDifficulty, "advanced");
  assert.equal(currentBlueprint.interviewTimeBudget, 20);
  assert.ok(currentBlueprint.initialQuestion.length > 0);
  assert.ok(currentBlueprint.technicalAreas.length > 0);
  assert.ok(currentBlueprint.behavioralAreas.includes("ownership"));
  assert.equal(currentBlueprint.resumeClaimsToVerify.length, currentBlueprint.resumeClaims.length);
  assert.equal(currentBlueprint.jdGapsToProbe.length, currentBlueprint.jdGaps.length);
  assert.ok(currentBlueprint.competencyWeights.system_design > 0);
  assert.ok(currentBlueprint.requiredEvidencePerCompetency.system_design >= 1);
  const migration = currentBlueprint.resumeClaims.find(
    (claim) => claim.id === "migration_100k_dau",
  );
  assert.deepEqual(
    migration && {
      claim: migration.claim,
      sourceFromCV: migration.sourceFromCV,
      relatedJDCompetency: migration.relatedJDCompetency,
      importance: migration.importance,
      verificationNeeded: migration.verificationNeeded,
      verificationStatus: migration.verificationStatus,
    },
    {
      claim: "Led migration serving 100k DAU",
      sourceFromCV: RESUME,
      relatedJDCompetency: "system_design",
      importance: "high",
      verificationNeeded: true,
      verificationStatus: "PENDING",
    },
  );
  assert.ok(currentBlueprint.jdGaps.some((gap) => gap.id === "architecture_microfrontend"));
});

test("five branching paths produce different directives, questions, and state deltas", () => {
  const strong = startBranch("A");
  const strongResults = [
    answerBranch(
      strong,
      "Em đo bằng Lighthouse và RUM field data, LCP p75 từ 4s xuống 2s nhờ preload hero, CDN và lazy load; em theo dõi bằng Datadog.",
      30_000,
    ),
    answerBranch(
      strong,
      "Em thiết kế React và Next.js rendering, cache data fetching, module boundaries và theo dõi p75 bằng Lighthouse; kết quả giảm latency 30%.",
      60_000,
    ),
    answerBranch(
      strong,
      "Em trực tiếp led migration serving 100k DAU, chọn architecture boundary, cache, database và scale ngang; em đo p95 và chấp nhận trade-off chi phí vận hành.",
      90_000,
    ),
    answerBranch(
      strong,
      "Em thiết kế module federation microfrontend, chia boundary theo domain, version shared dependencies, canary deploy, rollback, monitor trade-off và giảm bundle 30% cho 8 team; em đo RUM p75 bằng Lighthouse, Datadog.",
      120_000,
    ),
    answerBranch(
      strong,
      "Em dùng semantic HTML, keyboard navigation, ARIA, axe và test; Lighthouse, RUM, p75, Datadog monitor đạt 98% trước release.",
      150_000,
    ),
    answerBranch(
      strong,
      "Em thiết kế GraphQL schema, query batching, cache, authorization, đo latency p95 bằng Datadog, Grafana, RUM, monitor bottleneck và giảm 40%.",
      180_000,
    ),
  ];
  assert.ok(
    strongResults.some(
      (result) =>
        result.directive.action === "DEEP_DIVE" || result.state.currentDifficulty === "expert",
    ),
  );
  assert.ok(strongResults.some((result) => result.directive.action === "SWITCH_COMPETENCY"));
  assert.equal(strongResults.at(-1)?.directive.action, "CLOSE_INTERVIEW");
  assert.equal(
    strongResults[0]?.evaluation.claims.find((claim) => claim.id === "lcp_4s_to_2s")?.status,
    "VERIFIED",
  );
  assert.equal(
    strongResults[2]?.evaluation.claims.find((claim) => claim.id === "migration_100k_dau")?.status,
    "VERIFIED",
  );

  const weak = startBranch("B");
  const weakResult = answerBranch(weak, "Em có làm performance.", 30_000);
  assert.notEqual(weakResult.directive.action, "SWITCH_COMPETENCY");
  assert.ok(["FOLLOW_UP", "VERIFY_RESUME_CLAIM", "CLARIFY"].includes(weakResult.directive.action));
  assert.notEqual(
    strongResults[0]?.nextQuestion?.prompt,
    weakResult.nextQuestion?.prompt,
    "Answer N must change question N+1",
  );
  assert.equal(
    weakResult.state.coverageByCompetency.frontend_performance?.coverageStatus,
    "IN_PROGRESS",
  );

  const contradictionBlueprint = blueprint();
  const migrationQuestion = {
    id: "migration-question",
    prompt: 'CV: "Led migration serving 100k DAU."',
    competency: "system_design",
  };
  const verified = runAdaptiveTurn({
    blueprint: contradictionBlueprint,
    state: stateAtCompetency(contradictionBlueprint, "system_design"),
    currentQuestion: migrationQuestion,
    candidateSpeechText:
      "Em trực tiếp led migration serving 100k DAU, dùng architecture boundary, cache, database, scale và đo p95.",
    elapsedTimeMs: 10_000,
    remainingTimeMs: 1_190_000,
    turnId: "C-verified",
  });
  const partial = runAdaptiveTurn({
    blueprint: contradictionBlueprint,
    state: stateAtCompetency(contradictionBlueprint, "system_design"),
    currentQuestion: migrationQuestion,
    candidateSpeechText: "team em làm",
    elapsedTimeMs: 10_000,
    remainingTimeMs: 1_190_000,
    turnId: "C-partial",
  });
  const contradicted = runAdaptiveTurn({
    blueprint: contradictionBlueprint,
    state: stateAtCompetency(contradictionBlueprint, "system_design"),
    currentQuestion: migrationQuestion,
    candidateSpeechText: "em thực ra không tham gia phần đó",
    elapsedTimeMs: 10_000,
    remainingTimeMs: 1_190_000,
    turnId: "C-contradiction",
  });
  assert.equal(
    verified.evaluation.claims.find((claim) => claim.id === "migration_100k_dau")?.status,
    "VERIFIED",
  );
  assert.equal(
    partial.evaluation.claims.find((claim) => claim.id === "migration_100k_dau")?.status,
    "PARTIAL",
  );
  assert.equal(
    contradicted.evaluation.claims.find((claim) => claim.id === "migration_100k_dau")?.status,
    "CONTRADICTION",
  );
  assert.equal(contradicted.directive.action, "CHALLENGE");
  assert.notDeepEqual(verified.state.resumeClaimStatuses, contradicted.state.resumeClaimStatuses);
  assert.notEqual(verified.directive.action, contradicted.directive.action);

  const noExperience = startBranch("D");
  noExperience.state = stateAtCompetency(noExperience.blueprint, "architecture_microfrontend");
  noExperience.currentQuestion = {
    id: "D-question",
    prompt: "Bạn có kinh nghiệm microfrontend không?",
    competency: "architecture_microfrontend",
  };
  const scenario = answerBranch(
    noExperience,
    "Em chưa từng làm microfrontend trực tiếp, nhưng em hiểu cần tách frontend theo domain.",
    30_000,
  );
  assert.equal(scenario.directive.action, "ASK_SCENARIO");
  assert.match(scenario.nextQuestion?.prompt ?? "", /migration|boundary|deploy|đánh đổi/i);

  const offTopic = startBranch("E");
  const offTopicResult = answerBranch(
    offTopic,
    "Cuối tuần em thích đi du lịch và xem bóng đá với bạn bè.",
    30_000,
  );
  assert.equal(offTopicResult.directive.action, "RECOVER");
  assert.equal(offTopicResult.state.currentCompetency, "frontend_performance");

  const transcriptSummary = [strong, weak, noExperience, offTopic]
    .map((branch) => branch.transcript.map((turn) => `${turn.speaker}:${turn.text}`).join("\n"))
    .join("\n---\n");
  assert.ok(
    transcriptSummary.length > 500,
    "branch evidence must contain full transcript material",
  );
});

test("coverage, difficulty, and time policy drive switching and closing", () => {
  for (const minutes of [10, 20, 30]) {
    const currentBlueprint = blueprint(minutes);
    const state = createInitialInterviewState(currentBlueprint);
    assert.equal(currentBlueprint.interviewTimeBudget, minutes);
    assert.equal(state.timeBudgetMinutes, minutes);
  }
  const currentBlueprint = blueprint(10);
  const base = createInitialInterviewState(currentBlueprint, {
    maxTurns: 40,
    remainingTimeMs: 60_000,
  });
  const coverage = Object.fromEntries(
    currentBlueprint.competencies.map((item) => [
      item.id,
      {
        ...base.coverageByCompetency[item.id],
        coverageStatus:
          item.id === "frontend_performance" ? ("SUFFICIENT" as const) : ("NOT_STARTED" as const),
        evidenceCount: item.id === "frontend_performance" ? 1 : 0,
        evidenceStrength: item.id === "frontend_performance" ? 0.9 : 0,
        confidence: item.id === "frontend_performance" ? 0.9 : 0,
      },
    ]),
  );
  const lowTimeState = {
    ...base,
    currentCompetency: "frontend_performance",
    coverageByCompetency: coverage,
    resumeClaimsPending: [],
    resumeClaimStatuses: Object.fromEntries(
      currentBlueprint.resumeClaims.map((claim) => [claim.id, "VERIFIED" as const]),
    ),
    jdGapsRemaining: [],
    remainingTimeMs: 60_000,
    turnNumber: 1,
  };
  const evaluation = {
    competency: "frontend_performance",
    answerQuality: "strong" as const,
    evidenceStrength: 0.9,
    claims: [],
    gaps: [],
    recommendedActions: ["DEEP_DIVE" as const],
    evidence: [{ kind: "metric" as const, text: "metric", strength: 0.9 }],
    contradictions: [],
    unresolvedQuestions: [],
    directExperience: "direct" as const,
    repeatRequested: false,
    isOffTopic: false,
    isUnusable: false,
    difficultySignal: "strong" as const,
    depthReached: 2,
    answerSummary: "strong evidence",
  };
  const priority = decideNextAction({
    blueprint: currentBlueprint,
    state: lowTimeState,
    recentTranscript: [],
    lastEvaluation: evaluation,
    remainingTimeMs: 60_000,
  });
  assert.equal(priority.action, "SWITCH_COMPETENCY");
  assert.ok(currentBlueprint.mustHaveCompetencies.includes(priority.competency ?? ""));
  assert.equal(priority.competency, "react_next");

  const allCovered = {
    ...lowTimeState,
    coverageByCompetency: Object.fromEntries(
      currentBlueprint.competencies.map((item) => [
        item.id,
        {
          ...base.coverageByCompetency[item.id],
          coverageStatus: "SUFFICIENT" as const,
          evidenceCount: 1,
          evidenceStrength: 0.9,
          confidence: 0.9,
        },
      ]),
    ),
    niceToHaveRemaining: ["accessibility"],
  };
  const close = decideNextAction({
    blueprint: currentBlueprint,
    state: allCovered,
    recentTranscript: [],
    lastEvaluation: evaluation,
    remainingTimeMs: 60_000,
  });
  assert.equal(close.action, "CLOSE_INTERVIEW", "low time drops nice-to-have exploration");

  const notQuestionCount = decideNextAction({
    blueprint: currentBlueprint,
    state: {
      ...allCovered,
      turnNumber: 39,
      maxTurns: 40,
      remainingTimeMs: 500_000,
      coverageByCompetency: coverage,
    },
    recentTranscript: [],
    lastEvaluation: evaluation,
    remainingTimeMs: 500_000,
  });
  assert.notEqual(
    notQuestionCount.action,
    "CLOSE_INTERVIEW",
    "maxTurns is a safety boundary, not the normal strategy",
  );
});

test("evidence report scores only referenced transcript evidence and replay is deterministic", () => {
  const first = startBranch("report");
  const result1 = answerBranch(
    first,
    "Em đo bằng Lighthouse và RUM field data, LCP p75 từ 4s xuống 2s nhờ preload hero, CDN và lazy load; em theo dõi bằng Datadog.",
    30_000,
  );
  const replayState = createInitialInterviewState(first.blueprint, {
    remainingTimeMs: first.blueprint.interviewTimeBudget * 60_000,
    maxTurns: 40,
  });
  const replay1 = runAdaptiveTurn({
    blueprint: first.blueprint,
    state: replayState,
    currentQuestion: {
      id: "report-q",
      prompt: generateInitialQuestion(first.blueprint, "vi").prompt,
      competency: "frontend_performance",
    },
    candidateSpeechText:
      "Em đo bằng Lighthouse và RUM field data, LCP p75 từ 4s xuống 2s nhờ preload hero, CDN và lazy load; em theo dõi bằng Datadog.",
    elapsedTimeMs: 30_000,
    remainingTimeMs: 1_170_000,
    turnId: "replay-turn",
  });
  const replay2 = runAdaptiveTurn({
    blueprint: first.blueprint,
    state: replayState,
    currentQuestion: {
      id: "report-q",
      prompt: generateInitialQuestion(first.blueprint, "vi").prompt,
      competency: "frontend_performance",
    },
    candidateSpeechText:
      "Em đo bằng Lighthouse và RUM field data, LCP p75 từ 4s xuống 2s nhờ preload hero, CDN và lazy load; em theo dõi bằng Datadog.",
    elapsedTimeMs: 30_000,
    remainingTimeMs: 1_170_000,
    turnId: "replay-turn",
  });
  assert.deepEqual(replay1, replay2);
  assert.equal(
    result1.state.coverageByCompetency.frontend_performance?.evidenceTurnIds[0],
    "report:candidate:1",
  );
  const report = buildAdaptiveEvidenceReport({
    blueprint: first.blueprint,
    state: result1.state,
    transcript: first.transcript,
  });
  const performance = report.competencies.find(
    (item) => item.competency === "frontend_performance",
  );
  const untouched = report.competencies.find((item) => item.competency === "react_next");
  assert.ok(typeof performance?.score === "number");
  assert.deepEqual(performance?.evidenceTranscriptRefs, ["report:candidate:1"]);
  assert.equal(
    untouched?.score,
    null,
    "a competency without transcript evidence cannot receive a score",
  );
  assert.equal(
    report.resumeClaims.find((claim) => claim.id === "lcp_4s_to_2s")?.status,
    "VERIFIED",
  );
});

test("director and generator expose every allowed behavior as structured actions", () => {
  const currentBlueprint = blueprint();
  const currentState = createInitialInterviewState(currentBlueprint);
  const actions = new Set(DIRECTOR_ACTIONS);
  assert.deepEqual(
    [...actions].sort(),
    [
      "ASK_SCENARIO",
      "CHALLENGE",
      "CLARIFY",
      "CLOSE_INTERVIEW",
      "DEEP_DIVE",
      "FOLLOW_UP",
      "PROBE_JD_GAP",
      "RECOVER",
      "SWITCH_COMPETENCY",
      "VERIFY_RESUME_CLAIM",
    ].sort(),
  );
  for (const action of DIRECTOR_ACTIONS) {
    const directive = {
      action,
      competency: "system_design",
      goal: `test ${action}`,
      difficulty: "advanced",
      reason: "matrix test",
      shouldClose: action === "CLOSE_INTERVIEW",
      difficultyLevel: "advanced" as const,
      evidenceTarget: "one concrete evidence signal",
    };
    const generated = generateNextQuestion({
      directive,
      language: "vi",
      turnNumber: currentState.turnNumber + 1,
      evaluation: {
        competency: "system_design",
        answerQuality: "partial",
        evidenceStrength: 0.4,
        claims: [],
        gaps: [],
        recommendedActions: [action],
        evidence: [],
        contradictions: [],
        unresolvedQuestions: [],
        directExperience: "unknown",
        repeatRequested: false,
        isOffTopic: false,
        isUnusable: false,
        difficultySignal: "solid",
        depthReached: 1,
        answerSummary: action,
      },
    });
    if (action === "CLOSE_INTERVIEW") assert.equal(generated, null);
    else assert.ok(generated?.prompt, `${action} must generate a question`);
  }
});

test("repeat and comprehension requests are clarified before recovery or switching", () => {
  const currentBlueprint = blueprint();
  const state = stateAtCompetency(currentBlueprint, "frontend_performance");
  const result = runAdaptiveTurn({
    blueprint: currentBlueprint,
    state,
    currentQuestion: {
      id: "repeat-question",
      prompt: "How did you measure LCP?",
      competency: "frontend_performance",
    },
    candidateSpeechText: "I don't understand the question, please repeat the question.",
    elapsedTimeMs: 20_000,
    remainingTimeMs: 1_180_000,
    turnId: "repeat-turn",
  });
  assert.equal(result.evaluation.repeatRequested, true);
  assert.equal(result.directive.action, "CLARIFY");
  assert.ok(result.nextQuestion?.prompt);
});
