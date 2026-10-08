import { candidatePassword } from "../../../scripts/verify-credentials.mjs";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const jar = [];

function cookieHeader() {
  return jar.map((item) => item.split(";")[0]).join("; ");
}

async function req(path, init = {}) {
  // Node fetch does not add the browser's same-origin Origin header. The
  // application intentionally rejects sensitive cookie-authenticated writes
  // without it, so keep this verifier aligned with browser requests.
  const headers = { Origin: BASE, ...(init.headers ?? {}), cookie: cookieHeader() };
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookie) jar.push(cookie);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 400) }; }
  return { status: response.status, json };
}

function assertNoSecret(value) {
  const serialized = JSON.stringify(value);
  if (/AIza|AQ\.Ab8|GEMINI_API_KEY=/.test(serialized)) {
    throw new Error("Secret leaked in API payload");
  }
}

const out = {};
const login = await req("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "nam.nguyen@example.com", password: candidatePassword() }),
});
out.login = { status: login.status, success: login.json?.success, twoFactor: Boolean(login.json?.twoFactorRequired) };

const runtime = await req("/api/runtime/status");
out.runtime = {
  status: runtime.status,
  gemini: runtime.json?.gemini,
  livekit: runtime.json?.livekit,
  ocr: runtime.json?.ocr,
  billing: runtime.json?.billing,
  esco: runtime.json?.esco,
};
assertNoSecret(runtime.json);

const momo = await req("/api/billing/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ planId: "starter", provider: "momo" }),
});
out.momo = { status: momo.status, error: momo.json?.error, code: momo.json?.code, success: momo.json?.success };

const jobs = await req("/api/jobs");
const first = jobs.json?.jobs?.[0];
out.jobs = {
  status: jobs.status,
  total: jobs.json?.total,
  matching: jobs.json?.matching,
  sample: first ? {
    title: first.title,
    matchScore: first.matchScorecard?.overallScore ?? null,
    matchedSkills: (first.matchScorecard?.matchedSkills ?? []).slice(0, 8),
    missingRequired: (first.matchScorecard?.missingRequiredSkills ?? []).slice(0, 8),
  } : null,
};

const resumes = await req("/api/resumes");
const active = (resumes.json?.resumes ?? []).find((item) => item.isActive) ?? resumes.json?.resumes?.[0];
const parsedText = typeof active?.parsedText === "string" ? active.parsedText : "";
out.resume = {
  filename: active?.filename ?? null,
  engine: active?.parserEngine ?? active?.parsed?.engine ?? null,
  skills: (active?.parsed?.extractedSkills ?? []).slice(0, 10),
  title: active?.parsed?.currentJobTitle ?? null,
  parsedChars: parsedText.length,
  looksSales: /sales|kinh doanh|bán hàng|chăm sóc khách/i.test(parsedText),
  snippet: parsedText.slice(0, 80).replace(/\s+/g, " "),
};

const session = await req("/api/interviews/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ targetRole: "Chuyên viên kinh doanh", difficulty: "mid", questionCount: 3, language: "vi", useMasterCv: true }),
});
out.session = { status: session.status, success: session.json?.success, id: session.json?.session?.id ?? null, error: session.json?.error, code: session.json?.code };
const sessionId = session.json?.session?.id;
if (sessionId) {
  await req(`/api/interviews/${sessionId}/start`, { method: "POST" });
  const questions = await req(`/api/interviews/${sessionId}/questions`);
  const items = Array.isArray(questions.json?.questions) ? questions.json.questions : [];
  const answers = [
    "Em từng phụ trách chăm sóc khách hàng doanh nghiệp, chốt đơn bằng cách làm rõ nhu cầu rồi đề xuất gói phù hợp, đo bằng doanh số tuần.",
    "Sau bán em gọi follow-up trong 48 giờ, ghi nhận phản hồi và xử lý khiếu nại trước khi leo thang lên quản lý.",
    "Em theo dõi tỷ lệ giữ khách và doanh số tuần trên bảng theo dõi, điều chỉnh lịch gọi khi khách có dấu hiệu rời.",
  ];
  await req(`/api/interviews/${sessionId}/transcripts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      segments: items.map((question, index) => ({
        speaker: "candidate",
        text: answers[index] ?? answers[0],
        questionId: question.id ?? null,
        startElapsedMs: 1000 + index * 8000,
        endElapsedMs: 7000 + index * 8000,
      })),
    }),
  });
  const complete = await req(`/api/interviews/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSeconds: 42 }),
  });
  out.complete = {
    status: complete.status,
    success: complete.json?.success,
    evaluationStatus: complete.json?.evaluationStatus ?? complete.json?.score?.evaluationStatus,
    provider: complete.json?.provider ?? complete.json?.score?.modelName,
    error: complete.json?.error,
    code: complete.json?.code,
    overallScore: complete.json?.score?.overallScore,
  };
  assertNoSecret(complete.json);
}

const livekit = sessionId ? await req(`/api/interviews/${sessionId}/livekit`) : { status: 0, json: null };
out.livekit = {
  status: livekit.status,
  configured: livekit.json?.configured,
  localMediaOnly: livekit.json?.localMediaOnly,
  message: livekit.json?.message,
};

assertNoSecret(out);
writeFileSync(new URL("../.data/runtime-verify.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
