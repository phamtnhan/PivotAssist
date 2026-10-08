import { candidatePassword } from "../../../scripts/verify-credentials.mjs";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const WAV = "C:/Users/Admin/Desktop/src/apps/web/.data/verify/stt-vi.wav";
const BANNED = ["STAR", "JD", "ATS", "Master CV"];

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["microphone"],
  });
  const page = await context.newPage();
  await login(page, "nam.nguyen@example.com", candidatePassword());

  const jobs = await page.evaluate(async () => {
    const response = await fetch("/api/jobs?pageSize=50", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    const list = payload?.jobs ?? [];
    return {
      status: response.status,
      total: payload?.total ?? list.length,
      xInterview: list.filter((job) => /x-interview/i.test(`${job.sourceUrl ?? ""} ${job.company?.name ?? ""} ${job.title ?? ""}`)).length,
      sourceUrls: [...new Set(list.map((job) => job.sourceUrl).filter(Boolean))].slice(0, 8),
      titles: list.slice(0, 5).map((job) => job.title),
    };
  });

  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const homeVi = await page.evaluate((banned) => {
    const text = document.body.innerText;
    return {
      title: document.title,
      leftover: banned.filter((word) => text.includes(word)),
      hasName: /Nguyễn Hoàng Quỳnh|Hoàng Quỳnh/.test(text),
      lastTime: text.includes("Lần gần nhất"),
      links: {
        profile: /Hồ sơ năng lực/.test(text),
        practice: /Luyện phỏng vấn/.test(text),
        jobs: /Tìm việc/.test(text),
      },
    };
  }, BANNED);

  await page.getByRole("button", { name: "EN" }).click();
  await page.waitForTimeout(500);
  const homeEn = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    lastTime: document.body.innerText.includes("Last time"),
    leftoverJd: document.body.innerText.includes("JD"),
  }));
  await page.getByRole("button", { name: "VI" }).click();

  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  const settingsTitle = await page.title();

  await page.goto(`${BASE}/legal`, { waitUntil: "domcontentloaded" });
  const legal = await page.evaluate(() => ({
    mic: /micro/i.test(document.body.innerText),
    camera: /camera/i.test(document.body.innerText),
    law: /An toàn thông tin mạng|Cybersecurity/i.test(document.body.innerText),
  }));

  const sessionStarted = Date.now();
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
  const sessionMs = Date.now() - sessionStarted;
  const sessionId = created?.session?.id;
  const firstQuestion = created?.firstQuestion ?? "";

  const ttsHits = [];
  page.on("response", (response) => {
    if (!response.url().includes("/api/tts/google")) return;
    ttsHits.push({
      status: response.status(),
      cache: response.headers()["x-tts-cache"] ?? null,
      ms: Math.round(response.timing()?.responseEnd ?? 0),
    });
  });

  const sttStarted = Date.now();
  const sttResponse = await context.request.post(`${BASE}/api/interviews/stt`, {
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

  let room = { draft: "", draftMs: null, leftover: [] };
  if (sessionId) {
    const roomStarted = Date.now();
    await page.goto(`${BASE}/interview/room?sessionId=${encodeURIComponent(sessionId)}&lang=vi`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => /Câu hỏi 1/.test(document.body.innerText), { timeout: 25_000 });
    await page.waitForFunction(() => {
      const draft = document.querySelector("[data-testid='interview-answer']");
      return Boolean(draft && draft.value && draft.value.trim().length > 2);
    }, { timeout: 28_000 }).catch(() => null);
    room = await page.evaluate((banned) => ({
      draft: document.querySelector("[data-testid='interview-answer']")?.value ?? "",
      leftover: banned.filter((word) => document.body.innerText.includes(word)),
      micOn: document.body.innerText.includes("Micro đang mở"),
    }), BANNED);
    room.draftMs = Date.now() - roomStarted;
  }

  console.log(JSON.stringify({
    jobs,
    homeVi,
    homeEn,
    settingsTitle,
    legal,
    interview: { sessionMs, firstQuestionChars: firstQuestion.length, ttsHits, stt, room: { ...room, draftChars: room.draft.length } },
  }, null, 2));
} finally {
  await browser.close();
}
