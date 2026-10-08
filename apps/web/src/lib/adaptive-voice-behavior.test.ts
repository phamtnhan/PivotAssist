import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyCandidateSilence,
  createTtsPlaybackGuard,
  isLongAnswer,
  mergeSttDraft,
  shouldInterruptAssistantSpeech,
} from "./voice-turn-behavior.ts";

test("voice behavior handles barge-in, silence, partial/correction, and long answers", () => {
  assert.equal(
    shouldInterruptAssistantSpeech({ assistantSpeaking: true, transcript: "Em muốn trả lời" }),
    true,
  );
  assert.equal(
    shouldInterruptAssistantSpeech({ assistantSpeaking: false, transcript: "Em muốn trả lời" }),
    false,
  );

  assert.equal(
    classifyCandidateSilence({ silenceMs: 1_200, hasSpeech: true, draft: "một câu trả lời" }),
    "COMMIT",
  );
  assert.equal(classifyCandidateSilence({ silenceMs: 1_500, hasSpeech: true, draft: "" }), "WAIT");
  assert.equal(
    classifyCandidateSilence({ silenceMs: 3_200, hasSpeech: false, draft: "" }),
    "RETRY",
  );

  assert.equal(
    mergeSttDraft("Em đang thiết kế", "Em đang thiết kế hệ thống"),
    "Em đang thiết kế hệ thống",
    "partial transcript extends the draft",
  );
  assert.equal(
    mergeSttDraft("Em đang thiết kế hệ thống", "Em đang nói về cache"),
    "Em đang nói về cache",
    "STT correction replaces the prior draft",
  );
  assert.equal(isLongAnswer("x".repeat(950)), true);

  const guard = createTtsPlaybackGuard();
  assert.equal(guard.claim("session:turn-1"), true);
  assert.equal(
    guard.claim("session:turn-1"),
    false,
    "a committed assistant turn plays at most once",
  );
  assert.equal(guard.claim("session:turn-2"), true);
  assert.equal(guard.size(), 2);

  const prompt = "Bạn hãy chia sẻ dự án phù hợp nhất với năng lực cốt lõi của bạn";
  assert.equal(
    shouldInterruptAssistantSpeech({
      assistantSpeaking: true,
      transcript: "Bạn hãy chia sẻ",
      prompt,
    }),
    false,
    "acoustic echo of question must not interrupt",
  );
  assert.equal(
    shouldInterruptAssistantSpeech({
      assistantSpeaking: true,
      transcript: "Tôi xin ngắt lời",
      prompt,
    }),
    true,
    "genuine candidate barge-in is permitted",
  );
});
