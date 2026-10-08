import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { browserLoginPayload } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";
const WAV = "C:/Users/Admin/Desktop/src/apps/web/.data/verify/stt-vi.wav";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${WAV}`,
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["microphone"],
});
await context.addInitScript(() => {
  window.localStorage.setItem("pivotassist:media-consent", JSON.stringify({ mic: true, "camera-mic": true }));
});
const page = await context.newPage();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const login = await page.evaluate(async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return response.json().catch(() => null);
  }, browserLoginPayload("candidate"));
  if (!login?.success) throw new Error("login failed");

  const apiStarted = Date.now();
  const apiResponse = await context.request.post(`${BASE}/api/interviews/stt`, {
    multipart: {
      audio: {
        name: "stt-vi.wav",
        mimeType: "audio/wav",
        buffer: readFileSync(WAV),
      },
      lang: "vi",
    },
  });
  const apiBody = await apiResponse.json().catch(() => null);
  const apiMs = Date.now() - apiStarted;
  const apiText = typeof apiBody?.text === "string" ? apiBody.text : "";
  console.log(JSON.stringify({
    api: {
      status: apiResponse.status(),
      ms: apiMs,
      success: Boolean(apiBody?.success),
      text: apiText,
      hasName: /quỳnh|quynh|kinh doanh/i.test(apiText),
      error: apiBody?.error ?? null,
    },
  }, null, 2));

  const created = await page.evaluate(async () => {
    const response = await fetch("/api/interviews/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetRole: "Chuyên viên kinh doanh",
        difficulty: "mid",
        questionCount: 5,
        language: "vi",
        useMasterCv: true,
      }),
    });
    return response.json().catch(() => null);
  });
  const sessionId = created?.session?.id;
  if (!sessionId) throw new Error(`session failed ${JSON.stringify(created)}`);

  await page.goto(`${BASE}/interview/room?role=Chuyen+vien+kinh+doanh&sessionId=${encodeURIComponent(sessionId)}&lang=vi`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /Câu hỏi 1/.test(document.body.innerText), { timeout: 25_000 });
  await page.waitForFunction(() => {
    const draft = document.querySelector("[data-testid='interview-answer']");
    return Boolean(draft && draft.value && draft.value.trim().length > 2);
  }, { timeout: 42_000 }).catch(() => null);

  const dump = await page.evaluate(() => ({
    hasSR: "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    draft: document.querySelector("[data-testid='interview-answer']")?.value ?? "",
    hearing: /ĐANG NGHE|Đang nghe/.test(document.body.innerText),
    micOn: document.body.innerText.includes("Micro đang mở"),
    leftover: ["STAR", "JD", "ATS"].filter((word) => document.body.innerText.includes(word)),
  }));
  console.log(JSON.stringify({
    sessionId,
    ...dump,
    hasNameInDraft: /quỳnh|quynh|kinh doanh|xin chào|xin chao/i.test(dump.draft),
  }, null, 2));
} finally {
  await browser.close();
}
