import { candidatePassword, staffPassword } from "../../../scripts/verify-credentials.mjs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const BANNED = ["STAR", "JD", "ATS", "Master CV"];

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

async function inspect(page, path, width) {
  await page.setViewportSize({ width, height: width < 500 ? 844 : 800 });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(500);
  return page.evaluate((banned) => {
    const text = document.body.innerText;
    return {
      path: location.pathname,
      title: document.title,
      leftover: banned.filter((word) => text.includes(word)),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      chat: Boolean(document.querySelector("button[aria-label='Mở chat hỗ trợ'], button[aria-label='Open support chat']")),
    };
  }, BANNED);
}

const browser = await chromium.launch({ headless: true });
try {
  const user = await browser.newContext();
  const page = await user.newPage();
  await login(page, "nam.nguyen@example.com", candidatePassword());

  const jobsApi = await page.evaluate(async () => {
    const t0 = Date.now();
    const response = await fetch("/api/jobs?pageSize=50", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    const list = payload?.jobs ?? [];
    return {
      status: response.status,
      ms: Date.now() - t0,
      total: payload?.total ?? list.length,
      xInterview: list.filter((job) => /x-interview/i.test(`${job.sourceUrl ?? ""}`)).length,
      leftoverTitles: list.filter((job) => /STAR|Master CV/.test(`${job.title ?? ""}`)).length,
      sample: list.slice(0, 4).map((job) => ({ title: job.title, sourceUrl: job.sourceUrl ?? null })),
    };
  });

  const user390 = [];
  for (const path of ["/home", "/jobs", "/profiles", "/interview", "/interview/setup", "/face-to-face", "/applications", "/settings", "/legal", "/services"]) {
    user390.push(await inspect(page, path, 390));
  }
  const user1280 = [];
  for (const path of ["/home", "/jobs", "/interview/setup"]) {
    user1280.push(await inspect(page, path, 1280));
  }

  await page.goto(`${BASE}/home`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(600);
  const home = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      name: /Nguyễn Hoàng Quỳnh|Hoàng Quỳnh/.test(text),
      lastTime: text.includes("Lần gần nhất"),
      profile: /Hồ sơ/.test(text),
      practice: /Luyện|phỏng vấn/.test(text),
      jobs: /Tìm việc|Việc làm/.test(text),
      wasteCopy: /AI chỉ dùng micro|Camera dành cho/.test(text),
    };
  });
  await page.getByRole("button", { name: "EN" }).click();
  await page.waitForTimeout(400);
  const homeEn = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    lastTime: document.body.innerText.includes("Last time"),
    leftoverJd: document.body.innerText.includes("JD"),
  }));
  await page.getByRole("button", { name: "VI" }).click();

  await page.goto(`${BASE}/legal`, { waitUntil: "domcontentloaded" });
  const legal = await page.evaluate(() => ({
    mic: /micro/i.test(document.body.innerText),
    camera: /camera/i.test(document.body.innerText),
    law: /An toàn thông tin mạng|Cybersecurity/i.test(document.body.innerText),
  }));

  const ent = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const entPage = await ent.newPage();
  await login(entPage, "recruiter@nexusai.local", staffPassword());
  const entPages = [];
  for (const path of ["/enterprise/dashboard", "/enterprise/jobs/create", "/enterprise/analytics", "/enterprise/settings", "/face-to-face"]) {
    entPages.push(await inspect(entPage, path, 1280));
  }
  await entPage.goto(`${BASE}/enterprise/dashboard`, { waitUntil: "domcontentloaded" });
  await entPage.waitForTimeout(500);
  const before = entPage.url();
  await entPage.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((node) => /Hỗ trợ|Support/i.test(node.innerText));
    btn?.click();
  });
  await entPage.waitForTimeout(400);
  const enterprise = {
    stayed: entPage.url() === before,
    createRoom: await entPage.evaluate(() => document.body.innerText.includes("Tạo phòng phỏng vấn")),
    leftoverMeet: await entPage.evaluate(() => /gặp mặt trực tiếp/i.test(document.body.innerText)),
    chatOpen: await entPage.evaluate(() => Boolean(document.querySelector("input[placeholder], textarea")) && /Hỗ trợ|Support|Nhắn/i.test(document.body.innerText)),
  };

  const admin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminPage = await admin.newPage();
  await login(adminPage, "admin@pivotassist.local", staffPassword());
  const adminPages = [];
  for (const path of ["/admin", "/admin/users", "/admin/support", "/admin/interviews"]) {
    adminPages.push(await inspect(adminPage, path, 1280));
  }
  const adminSupport = await adminPage.evaluate(() => ({
    floatingChat: Boolean(document.querySelector("button[aria-label='Mở chat hỗ trợ']")),
    filters: /Ứng viên/.test(document.body.innerText) && /Doanh nghiệp/.test(document.body.innerText),
  }));

  console.log(JSON.stringify({
    jobsApi,
    home,
    homeEn,
    legal,
    enterprise,
    adminSupport,
    leftoverAny: [...user390, ...user1280, ...entPages, ...adminPages].filter((row) => row.leftover.length || row.overflowX),
    user390,
    user1280,
    entPages,
    adminPages,
  }, null, 2));
} finally {
  await browser.close();
}
