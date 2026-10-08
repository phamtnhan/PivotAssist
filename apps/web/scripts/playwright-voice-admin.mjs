import { candidatePassword, staffPassword } from "../../../scripts/verify-credentials.mjs";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const WAV = "C:/Users/Admin/Desktop/src/apps/web/.data/verify/stt-vi.wav";

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const body = await page.evaluate(async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return response.json().catch(() => null);
  }, { email, password });
  if (!body?.success) throw new Error(`login failed ${email}`);
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${WAV}`,
  ],
});

try {
  const admin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminPage = await admin.newPage();
  await login(adminPage, "admin@pivotassist.local", staffPassword());
  await adminPage.goto(`${BASE}/admin/support`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await adminPage.waitForTimeout(700);
  const adminSupport = await adminPage.evaluate(() => ({
    path: location.pathname,
    all: /Tất cả|All/.test(document.body.innerText),
    user: /Ứng viên|Applicants/.test(document.body.innerText),
    ent: /Doanh nghiệp|Employers/.test(document.body.innerText),
    floatingChat: Boolean(document.querySelector("button[aria-label='Mở chat hỗ trợ']")),
  }));

  const user = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["microphone"],
  });
  await user.addInitScript(() => {
    window.localStorage.setItem("pivotassist:media-consent", JSON.stringify({ mic: true, "camera-mic": true }));
  });
  const page = await user.newPage();
  const tts = [];
  const ttsClock = Date.now();
  page.on("response", (response) => {
    if (!response.url().includes("/api/tts/google")) return;
    tts.push({
      status: response.status(),
      cache: response.headers()["x-tts-cache"] ?? null,
      atMs: Date.now() - ttsClock,
    });
  });
  await login(page, "nam.nguyen@example.com", candidatePassword());

  const sttStarted = Date.now();
  const sttResponse = await user.request.post(`${BASE}/api/interviews/stt`, {
    multipart: {
      audio: { name: "stt-vi.wav", mimeType: "audio/wav", buffer: readFileSync(WAV) },
      lang: "vi",
    },
  });
  const sttBody = await sttResponse.json().catch(() => null);
  const stt = {
    status: sttResponse.status(),
    ms: Date.now() - sttStarted,
    chars: typeof sttBody?.text === "string" ? sttBody.text.length : 0,
    hasText: Boolean(sttBody?.text),
  };

  const createSession = () => page.evaluate(async () => {
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
  const warmStarted = Date.now();
  const created = await createSession();
  const sessionMs = Date.now() - warmStarted;
  const sessionId = created?.session?.id;
  const first = created?.firstQuestion ?? "";
  if (!sessionId) throw new Error("session failed");

  const prefetchStarted = Date.now();
  await page.evaluate(async (text) => {
    await fetch(`/api/tts/google?tl=vi&text=${encodeURIComponent(text)}`);
  }, first);
  const prefetchMs = Date.now() - prefetchStarted;

  const roomStarted = Date.now();
  await page.goto(`${BASE}/interview/room?sessionId=${encodeURIComponent(sessionId)}&lang=vi`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("[data-testid='interview-answer']", { timeout: 45_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-testid='interview-prompt']");
    const total = Number(el?.getAttribute("data-question-total") ?? "0");
    return total >= 2 && (el?.textContent ?? "").length > 40;
  }, { timeout: 25_000 });
  const firstQuestionMs = Date.now() - roomStarted;
  const roomUi = await page.evaluate(() => ({
    leftover: ["STAR", "JD", "ATS"].filter((word) => document.body.innerText.includes(word)),
    mic: /Micro/.test(document.body.innerText),
    cameraCopy: /camera|Camera dành cho/i.test(document.body.innerText),
    promptChars: document.querySelector("[data-testid='interview-prompt']")?.textContent?.length ?? 0,
  }));

  await page.fill("[data-testid='interview-answer']", "Tôi có hơn bốn năm kinh doanh B2B.");
  await page.waitForTimeout(300);
  const nextStarted = Date.now();
  await page.getByRole("button", { name: /Đã trả lời xong|finished answering/i }).first().click();
  await page.waitForFunction(() => {
    return document.querySelector("[data-testid='interview-prompt']")?.getAttribute("data-question-index") === "2";
  }, { timeout: 15_000 });
  const nextQuestionMs = Date.now() - nextStarted;

  console.log(JSON.stringify({
    adminSupport,
    stt,
    sessionMs,
    prefetchMs,
    firstQuestionMs,
    nextQuestionMs,
    tts,
    roomUi,
  }, null, 2));
} finally {
  await browser.close();
}
