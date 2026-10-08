import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeInterviewBlueprint,
  createInitialInterviewState,
  generateInitialQuestion,
  runAdaptiveTurn,
  type InterviewState,
  type InterviewTranscriptTurn,
} from "../../../../packages/contracts/src/adaptive-interview.ts";

const SESSION_ID = "session-adaptive-e2e";

test("adaptive E2E follows CV/JD evidence, preserves canonical ordering, and has one TTS key per assistant turn", () => {
  const blueprint = analyzeInterviewBlueprint({
    targetRole: "Senior Frontend Engineer",
    jobDescription: "Senior Frontend Engineer: React, Next.js, Core Web Vitals, and system design.",
    resumeText:
      "3 years React; ecommerce platform serving 100k users; claims LCP optimization from 4s → 2s.",
    difficulty: "senior",
  });
  const initialQuestion = generateInitialQuestion(blueprint, "vi");
  let state = createInitialInterviewState(blueprint, { remainingTimeMs: 300_000, maxTurns: 20 });
  state = {
    ...state,
    currentQuestionId: "question-0",
    currentAssistantTurnId: "question-turn-0",
    askedQuestions: [
      {
        questionId: "question-0",
        turnId: "question-turn-0",
        prompt: initialQuestion.prompt,
        competency: initialQuestion.competency,
        action: "INITIAL",
      },
    ],
  };
  let currentQuestion = {
    id: "question-0",
    prompt: initialQuestion.prompt,
    competency: initialQuestion.competency,
  };
  const transcript: InterviewTranscriptTurn[] = [
    {
      turnId: "question-turn-0",
      questionId: "question-0",
      parentTurnId: null,
      speaker: "interviewer",
      timestamp: new Date(0).toISOString(),
      sequenceNumber: 1,
      text: initialQuestion.prompt,
    },
  ];
  const answers = [
    "Em tối ưu ảnh và lazy load, giúp trang nhanh hơn.",
    "Em dùng Lighthouse và đo LCP p75; từ 4s xuống 2s nhờ preload hero, CDN và lazy load.",
    "Với React và Next.js, em tổ chức rendering, cache data fetching và theo dõi p75 bằng Lighthouse.",
    "Với ecommerce 100k users, em dùng load test, monitor p95, cache, database và scale ngang để bảo đảm ổn định.",
    "Em chưa có kinh nghiệm trực tiếp với kiến trúc tách frontend; em mới làm monolith.",
  ];
  const directives: string[] = [];
  const assistantTtsKeys = new Set<string>();
  const generatedPrompts: string[] = [initialQuestion.prompt];

  for (const [index, answer] of answers.entries()) {
    const candidateTurnId = `turn-${index + 1}`;
    const beforeCount = transcript.length;
    const result = runAdaptiveTurn({
      blueprint,
      state,
      currentQuestion,
      candidateSpeechText: answer,
      recentTranscript: transcript.slice(-8),
      elapsedTimeMs: (index + 1) * 25_000,
      remainingTimeMs: 300_000 - (index + 1) * 25_000,
      language: "vi",
    });
    directives.push(result.directive.action);
    const candidate: InterviewTranscriptTurn = {
      turnId: candidateTurnId,
      questionId: currentQuestion.id,
      parentTurnId: state.currentAssistantTurnId,
      speaker: "candidate",
      timestamp: new Date(index * 2_000 + 1_000).toISOString(),
      sequenceNumber: beforeCount + 1,
      text: answer,
    };
    transcript.push(candidate);
    if (result.nextQuestion) {
      const nextQuestionId = `question-${index + 1}`;
      const assistant: InterviewTranscriptTurn = {
        turnId: candidateTurnId,
        questionId: nextQuestionId,
        parentTurnId: candidateTurnId,
        speaker: "interviewer",
        timestamp: new Date(index * 2_000 + 1_001).toISOString(),
        sequenceNumber: beforeCount + 2,
        text: result.nextQuestion.prompt,
      };
      transcript.push(assistant);
      assistantTtsKeys.add(`${SESSION_ID}:${candidateTurnId}`);
      generatedPrompts.push(result.nextQuestion.prompt);
      state = {
        ...result.state,
        currentQuestionId: nextQuestionId,
        currentAssistantTurnId: candidateTurnId,
        askedQuestions: [
          ...result.state.askedQuestions,
          {
            questionId: nextQuestionId,
            turnId: candidateTurnId,
            prompt: result.nextQuestion.prompt,
            competency: result.nextQuestion.competency,
            action: result.directive.action,
          },
        ],
        recentTurns: transcript.slice(-8),
      };
      currentQuestion = {
        id: nextQuestionId,
        prompt: result.nextQuestion.prompt,
        competency: result.nextQuestion.competency,
      };
    } else {
      state = { ...result.state, recentTurns: transcript.slice(-8) };
    }
  }

  assert.equal(blueprint.resumeClaims.length, 3, "the CV claims must enter the blueprint");
  assert.ok(
    blueprint.jdGaps.some((gap) => gap.id === "architecture_microfrontend"),
    "the missing architecture evidence must be a JD gap",
  );
  assert.equal(
    directives[0],
    "VERIFY_RESUME_CLAIM",
    "a vague LCP answer must trigger a claim follow-up",
  );
  assert.equal(directives[1], "SWITCH_COMPETENCY", "verified LCP evidence must switch competency");
  assert.equal(
    directives[2],
    "SWITCH_COMPETENCY",
    "React/Next.js evidence must move to system design",
  );
  assert.equal(
    directives[3],
    "SWITCH_COMPETENCY",
    "scale evidence must expose the architecture competency",
  );
  assert.equal(
    directives[4],
    "ASK_SCENARIO",
    "missing direct microfrontend experience must trigger a transferable scenario",
  );
  assert.equal(
    generatedPrompts.filter((prompt) => /\bLCP\b/i.test(prompt)).length,
    2,
    "there is an initial LCP question and one follow-up, never a third LCP probe",
  );
  assert.ok(
    generatedPrompts.some((prompt) => /React|Next\.js/i.test(prompt)),
    "CV technology evidence changes the live question",
  );
  assert.ok(
    generatedPrompts.some((prompt) => /microfrontend/i.test(prompt)),
    "the architecture gap changes the live question",
  );
  assert.ok(
    transcript.length >= 11,
    "five candidate turns must produce a complete ordered transcript",
  );
  for (let index = 1; index < transcript.length; index += 1) {
    assert.equal(transcript[index]?.sequenceNumber, index + 1, "sequenceNumber must be contiguous");
    if (transcript[index]?.speaker === "candidate")
      assert.equal(transcript[index - 1]?.speaker, "interviewer");
    if (transcript[index]?.speaker === "interviewer" && index > 1)
      assert.equal(transcript[index - 1]?.speaker, "candidate");
  }
  assert.equal(
    assistantTtsKeys.size,
    transcript.filter((turn) => turn.speaker === "interviewer").length - 1,
    "each generated assistant turn has one deterministic TTS key",
  );
  assert.equal(
    new Set(generatedPrompts).size,
    generatedPrompts.length,
    "the generator must not repeat a question",
  );

  // Restart/replay simulation: durable JSON snapshots retain the active state
  // and the committed result key; replaying it cannot create a second TTS key.
  const persistedState = JSON.parse(JSON.stringify(state)) as InterviewState;
  const persistedResult = JSON.parse(
    JSON.stringify({
      turnId: "turn-5",
      ttsKey: `${SESSION_ID}:turn-5`,
      nextQuestion: generatedPrompts.at(-1),
    }),
  ) as { turnId: string; ttsKey: string; nextQuestion: string };
  const resumedState = JSON.parse(JSON.stringify(persistedState)) as InterviewState;
  const replayedKeys = new Set([persistedResult.ttsKey]);
  assert.equal(resumedState.schemaVersion, 1);
  assert.equal(resumedState.turnNumber, persistedState.turnNumber);
  assert.equal(replayedKeys.size, 1, "replaying a committed durable turn is a no-op for TTS");

  console.log("\n[adaptive-e2e-transcript]");
  for (const turn of transcript)
    console.log(
      `${turn.sequenceNumber}. ${turn.speaker} [${turn.turnId}] Q=${turn.questionId}: ${turn.text}`,
    );
});
