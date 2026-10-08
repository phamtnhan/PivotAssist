import { chromium } from "@playwright/test";
import { browserLoginPayload } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["microphone"],
});
const page = await context.newPage();
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

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
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
  const coldStarted = Date.now();
  const createdCold = await createSession();
  const sessionColdMs = Date.now() - coldStarted;
  const warmStarted = Date.now();
  const created = await createSession();
  const sessionMs = Date.now() - warmStarted;
  const sessionId = created?.session?.id;
  const first = created?.firstQuestion ?? createdCold?.firstQuestion ?? "";
  if (!sessionId) {
    throw new Error(`session failed ${JSON.stringify({ sessionColdMs, createdCold, created })}`);
  }

  const prefetchStarted = Date.now();
  await page.evaluate(async (text) => {
    await fetch(`/api/tts/google?tl=vi&text=${encodeURIComponent(text)}`);
  }, first);
  const prefetchMs = Date.now() - prefetchStarted;

  const roomStarted = Date.now();
  await page.goto(`${BASE}/interview/room?sessionId=${encodeURIComponent(sessionId)}&lang=vi`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("[data-testid='interview-answer']", { timeout: 25_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-testid='interview-prompt']");
    const total = Number(el?.getAttribute("data-question-total") ?? "0");
    const text = el?.textContent ?? "";
    return total >= 2 && text.length > 40;
  }, { timeout: 40_000 });
  const firstQuestionMs = Date.now() - roomStarted;

  await page.fill("[data-testid='interview-answer']", "Tôi có hơn bốn năm kinh doanh B2B.");
  await page.waitForTimeout(400);
  const nextBtn = page.getByRole("button", { name: /Đã trả lời xong|finished answering/i }).first();
  const nextStarted = Date.now();
  await nextBtn.click();
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-testid='interview-prompt']");
    return el?.getAttribute("data-question-index") === "2";
  }, { timeout: 15_000 });
  const nextQuestionMs = Date.now() - nextStarted;

  console.log(JSON.stringify({
    sessionColdMs,
    sessionMs,
    prefetchMs,
    firstQuestionMs,
    nextQuestionMs,
    tts,
    leftover: await page.evaluate(() => ["STAR", "JD", "ATS"].filter((word) => document.body.innerText.includes(word))),
  }, null, 2));
} finally {
  await browser.close();
}
