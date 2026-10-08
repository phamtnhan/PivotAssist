import { candidatePassword, staffPassword } from "../../../scripts/verify-credentials.mjs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";

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

const browser = await chromium.launch({ headless: true });
try {
  const user = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await user.newPage();
  await login(page, "nam.nguyen@example.com", candidatePassword());

  const jobsHtml = await page.evaluate(async () => {
    const response = await fetch("/jobs", { credentials: "include" });
    const html = await response.text();
    return {
      status: response.status,
      hasHcns: html.includes("Trưởng phòng hành chính nhân sự"),
      hasLoading: html.includes("Đang tải việc làm"),
    };
  });

  const multiStarted = Date.now();
  const multi = await page.evaluate(async () => {
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const t0 = Date.now();
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
      const payload = await response.json().catch(() => null);
      return {
        i: index,
        status: response.status,
        ms: Date.now() - t0,
        ok: Boolean(payload?.session?.id),
        provider: payload?.session ? "ok" : payload?.error ?? "fail",
      };
    }));
    return { wallMs: Date.now() - started, results };
  });
  const multiWall = Date.now() - multiStarted;

  const ent = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const entPage = await ent.newPage();
  await login(entPage, "recruiter@nexusai.local", staffPassword());
  await entPage.goto(`${BASE}/enterprise/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await entPage.waitForTimeout(600);
  const before = entPage.url();
  await entPage.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((node) => /Hỗ trợ|Support/i.test(node.innerText));
    btn?.click();
  });
  await entPage.waitForTimeout(400);
  const enterprise = {
    stayed: entPage.url() === before && entPage.url().includes("/enterprise/dashboard"),
    createRoom: await entPage.evaluate(() => document.body.innerText.includes("Tạo phòng phỏng vấn")),
    leftoverMeet: await entPage.evaluate(() => /gặp mặt trực tiếp/i.test(document.body.innerText)),
    leftover: await entPage.evaluate(() => ["STAR", "JD", "ATS", "Master CV"].filter((word) => document.body.innerText.includes(word))),
    chatOpen: await entPage.evaluate(() => Boolean(document.querySelector("input[placeholder='Nhắn tin…'], input[placeholder='Write a message…']"))),
    overflowX: await entPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2),
  };

  console.log(JSON.stringify({
    jobsHtml,
    multi: {
      wallMs: multiWall,
      ok: multi.results.filter((row) => row.ok).length,
      fail: multi.results.filter((row) => !row.ok).length,
      p50: [...multi.results].sort((a, b) => a.ms - b.ms)[3]?.ms ?? null,
      pMax: Math.max(...multi.results.map((row) => row.ms)),
      statuses: multi.results.map((row) => row.status),
    },
    enterprise,
  }, null, 2));
} finally {
  await browser.close();
}
