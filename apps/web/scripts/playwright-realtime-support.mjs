import { candidatePassword, staffPassword } from "../../../scripts/verify-credentials.mjs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const NOTE = `Realtime ${Date.now()}`;

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

const browser = await chromium.launch({ headless: true });
try {
  const admin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminPage = await admin.newPage();
  await login(adminPage, "admin@pivotassist.local", staffPassword());
  await adminPage.goto(`${BASE}/admin/support`, { waitUntil: "domcontentloaded" });
  await adminPage.waitForFunction(() => /Ứng viên|Doanh nghiệp/.test(document.body.innerText), { timeout: 20_000 });
  await adminPage.waitForTimeout(800);
  const before = await adminPage.evaluate((note) => document.body.innerText.includes(note), NOTE);

  const user = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const userPage = await user.newPage();
  await login(userPage, "nam.nguyen@example.com", candidatePassword());
  const sent = await userPage.evaluate(async (note) => {
    const response = await fetch("/api/support/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: note }),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, NOTE);

  const appeared = await adminPage.waitForFunction((note) => document.body.innerText.includes(note), NOTE, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  const url = adminPage.url();
  console.log(JSON.stringify({ note: NOTE, before, sent, appeared, stayed: url.includes("/admin/support") }, null, 2));
} finally {
  await browser.close();
}
