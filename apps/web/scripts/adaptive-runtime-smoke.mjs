import assert from "node:assert/strict";
import { candidatePassword } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";
const cookies = new Map();
const smokeEmail = process.env.ADAPTIVE_SMOKE_EMAIL ?? "nam.nguyen@example.com";

function cookieHeader() {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { origin: BASE, ...(init.headers ?? {}), cookie: cookieHeader() },
  });
  for (const setCookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = setCookie.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

const login = await request("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: smokeEmail, password: candidatePassword() }),
});
assert.equal(login.status, 200, JSON.stringify(login.body));

const created = await request("/api/interviews/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    targetRole: "Senior Frontend Engineer",
    customJd: "React, Next.js, Core Web Vitals, system design",
    difficulty: "senior",
    questionCount: 3,
    language: "vi",
    useMasterCv: true,
  }),
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const sessionId = created.body?.session?.id;
assert.equal(typeof sessionId, "string");

const started = await request(`/api/interviews/${sessionId}/start`, { method: "POST" });
assert.equal(started.status, 200, JSON.stringify(started.body));
const questions = await request(`/api/interviews/${sessionId}/questions?lang=vi`);
assert.equal(questions.status, 200, JSON.stringify(questions.body));
const firstQuestion = questions.body?.questions?.[0];
assert.equal(typeof firstQuestion?.id, "string");

const firstBody = {
  candidateSpeechText: "Em tối ưu ảnh và lazy load, giúp trang nhanh hơn.",
  questionId: firstQuestion.id,
  elapsedMs: 12_000,
  turnId: "runtime-replay-turn-1",
};
const first = await request(`/api/interviews/${sessionId}/agent-turn?lang=vi`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(firstBody),
});
assert.equal(first.status, 200, JSON.stringify(first.body));
assert.equal(first.body?.success, true);
assert.ok(first.body?.ttsKey?.endsWith(":runtime-replay-turn-1"));
assert.ok(["ADAPTIVE", "FALLBACK"].includes(first.body?.mode));

const replay = await request(`/api/interviews/${sessionId}/agent-turn?lang=vi`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(firstBody),
});
assert.equal(replay.status, 200, JSON.stringify(replay.body));
assert.deepEqual(replay.body, first.body, "durable replay must return exactly one committed result");

const second = await request(`/api/interviews/${sessionId}/agent-turn?lang=vi`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    candidateSpeechText: "Em dùng Lighthouse, đo LCP p75 từ 4s xuống 2s nhờ preload hero, CDN và lazy load.",
    questionId: first.body.nextQuestion.id,
    elapsedMs: 25_000,
    turnId: "runtime-replay-turn-2",
  }),
});
assert.equal(second.status, 200, JSON.stringify(second.body));
assert.notEqual(second.body?.nextQuestion?.prompt, first.body?.nextQuestion?.prompt, "candidate answer must change the next live question");

const transcript = await request(`/api/interviews/${sessionId}/transcripts`);
assert.equal(transcript.status, 200, JSON.stringify(transcript.body));
assert.equal(transcript.body?.segments?.length, 5, "initial question + two candidate/assistant exchanges must be ordered once");
const segments = transcript.body.segments;
assert.deepEqual(segments.map((segment) => segment.speaker), ["interviewer", "candidate", "interviewer", "candidate", "interviewer"]);
assert.deepEqual(segments.map((segment) => segment.sequenceNumber), [1, 2, 3, 4, 5]);

console.log(JSON.stringify({
  sessionId,
  firstQuestion: firstQuestion.prompt,
  firstAdaptiveQuestion: first.body.nextQuestion,
  replayEqual: JSON.stringify(replay.body) === JSON.stringify(first.body),
  secondAdaptiveQuestion: second.body.nextQuestion,
  mode: second.body.mode,
  ttsKeys: [first.body.ttsKey, second.body.ttsKey],
  transcript: segments.map((segment) => ({ sequenceNumber: segment.sequenceNumber, speaker: segment.speaker, turnId: segment.turnId, questionId: segment.questionId, text: segment.text })),
}, null, 2));
