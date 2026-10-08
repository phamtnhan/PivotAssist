import { candidatePassword, staffPassword } from "../../../scripts/verify-credentials.mjs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const BANNED = ["STAR", "JD", "ATS", "Master CV", "candidate", "database", "workspace", "shortlist", "Hybrid"];

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

async function inspect(page, path, extra = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  return page.evaluate(({ banned, extra }) => {
    const text = document.body.innerText;
    return {
      path: location.pathname,
      title: document.title,
      leftover: banned.filter((word) => text.includes(word)),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      chatBtn: Boolean(document.querySelector("button[aria-label]")),
      ...extra,
    };
  }, { banned: BANNED, extra });
}

const browser = await chromium.launch({ headless: true });

try {
  const user = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const userPage = await user.newPage();
  await login(userPage, "nam.nguyen@example.com", candidatePassword());
  const user390 = [];
  for (const path of ["/home", "/jobs", "/profiles", "/interview", "/face-to-face", "/settings", "/legal", "/services"]) {
    user390.push(await inspect(userPage, path));
  }
  await userPage.setViewportSize({ width: 1280, height: 800 });
  const user1280 = [];
  for (const path of ["/home", "/jobs", "/interview"]) {
    user1280.push(await inspect(userPage, path));
  }
  console.log(JSON.stringify({ user390, user1280 }, null, 2));
  await user.close();

  const ent = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const entPage = await ent.newPage();
  await login(entPage, "recruiter@nexusai.local", staffPassword());
  await entPage.goto(`${BASE}/enterprise/dashboard`, { waitUntil: "domcontentloaded" });
  await entPage.waitForTimeout(800);
  const before = entPage.url();
  const supportClicked = await entPage.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((node) => /Hỗ trợ|Support/i.test(node.innerText));
    btn?.click();
    return Boolean(btn);
  });
  await entPage.waitForTimeout(400);
  const entDump = await entPage.evaluate((banned) => ({
    path: location.pathname,
    leftover: banned.filter((word) => document.body.innerText.includes(word)),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    chatOpen: /Gửi|hỗ trợ|Support/i.test(document.body.innerText),
  }), BANNED);
  console.log(JSON.stringify({ enterprise: { before, after: entPage.url(), stayed: before === entPage.url(), supportClicked, ...entDump } }, null, 2));
  await ent.close();

  const admin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminPage = await admin.newPage();
  await login(adminPage, "admin@pivotassist.local", staffPassword());
  await adminPage.goto(`${BASE}/admin/support`, { waitUntil: "domcontentloaded" });
  await adminPage.waitForTimeout(800);
  const adminDump = await adminPage.evaluate((banned) => ({
    path: location.pathname,
    leftover: banned.filter((word) => document.body.innerText.includes(word)),
    hasCandidateFilter: /Ứng viên|Candidate/.test(document.body.innerText),
    hasBizFilter: /Doanh nghiệp|Business|Company/.test(document.body.innerText),
    floatingChat: Boolean([...document.querySelectorAll("button")].find((node) => node.getAttribute("aria-label") === "Mở hỗ trợ" || /Mở hỗ trợ/.test(node.getAttribute("aria-label") ?? ""))),
  }), BANNED);
  console.log(JSON.stringify({ admin: adminDump }, null, 2));
  await admin.close();
} finally {
  await browser.close();
}
