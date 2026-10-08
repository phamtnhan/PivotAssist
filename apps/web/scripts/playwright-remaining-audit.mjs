import { candidatePassword, staffPassword } from "../../../scripts/verify-credentials.mjs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const BANNED = ["STAR", "JD", "ATS", "Master CV"];
const NOTE = `Kiem tra realtime ${Date.now()}`;

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

async function dump(page, path, banned) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(650);
  return page.evaluate(({ banned }) => ({
    path: location.pathname,
    title: document.title,
    leftover: banned.filter((word) => document.body.innerText.includes(word)),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    hasRealtime: performance.getEntriesByType("resource").some((entry) => String(entry.name).includes("/api/realtime")),
  }), { banned });
}

const browser = await chromium.launch({ headless: true });
try {
  const userCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const userPage = await userCtx.newPage();
  await login(userPage, "nam.nguyen@example.com", candidatePassword());

  const created = await userPage.evaluate(async () => {
    const response = await fetch("/api/interviews/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetRole: "Chuyên viên kinh doanh", difficulty: "mid", questionCount: 5, language: "vi", useMasterCv: true }),
    });
    return response.json().catch(() => null);
  });
  const first = created?.firstQuestion ?? "";
  const tts = await userPage.evaluate(async (text) => {
    const url = `/api/tts/google?tl=vi&text=${encodeURIComponent(text)}`;
    const a0 = Date.now();
    const r1 = await fetch(url);
    const coldMs = Date.now() - a0;
    const cache1 = r1.headers.get("x-tts-cache");
    const a1 = Date.now();
    const r2 = await fetch(url);
    const warmMs = Date.now() - a1;
    const cache2 = r2.headers.get("x-tts-cache");
    return { coldMs, warmMs, cache1, cache2, status: r2.status, chars: text.length };
  }, first);

  const userPages = [];
  for (const path of ["/applications", "/interview/setup"]) {
    userPages.push(await dump(userPage, path, BANNED));
  }

  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminPage = await adminCtx.newPage();
  await login(adminPage, "admin@pivotassist.local", staffPassword());
  await adminPage.goto(`${BASE}/admin/support`, { waitUntil: "domcontentloaded" });
  await adminPage.waitForTimeout(800);
  const beforeHasNote = await adminPage.evaluate((note) => document.body.innerText.includes(note), NOTE);

  await userPage.evaluate(async (note) => {
    const response = await fetch("/api/support/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: note }),
    });
    return response.json().catch(() => null);
  }, NOTE);

  await adminPage.waitForFunction((note) => document.body.innerText.includes(note), NOTE, { timeout: 12_000 }).catch(() => null);
  const afterHasNote = await adminPage.evaluate((note) => document.body.innerText.includes(note), NOTE);
  const adminPages = [];
  for (const path of ["/admin", "/admin/users", "/admin/enterprises", "/admin/interviews", "/admin/billing"]) {
    adminPages.push(await dump(adminPage, path, BANNED));
  }

  const entCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const entPage = await entCtx.newPage();
  await login(entPage, "recruiter@nexusai.local", staffPassword());
  const entPages = [];
  for (const path of ["/enterprise/dashboard", "/enterprise/jobs/create", "/enterprise/analytics", "/enterprise/settings", "/face-to-face"]) {
    entPages.push(await dump(entPage, path, BANNED));
  }
  const roomLabel = await entPage.evaluate(() => ({
    create: document.body.innerText.includes("Tạo phòng phỏng vấn"),
    leftoverMeet: /gặp mặt trực tiếp/i.test(document.body.innerText),
  }));

  console.log(JSON.stringify({
    tts,
    realtime: { beforeHasNote, afterHasNote, note: NOTE },
    userPages,
    adminPages,
    entPages,
    roomLabel,
  }, null, 2));
} finally {
  await browser.close();
}
