import { chromium } from "@playwright/test";
import { browserLoginPayload } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";
const BANNED = ["STAR", "JD", "ATS", "Master CV"];

const browser = await chromium.launch({ headless: true });
try {
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const landing = await anon.newPage();
  await landing.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await landing.waitForTimeout(500);
  const land = await landing.evaluate((banned) => ({
    leftover: banned.filter((word) => document.body.innerText.includes(word)),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    waste: /AI chỉ dùng micro|Camera dành cho/.test(document.body.innerText),
    chat: Boolean(document.querySelector("button[aria-label='Mở chat hỗ trợ']")),
    title: document.title,
  }), BANNED);

  const admin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await admin.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email, password }) => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
  }, browserLoginPayload("admin"));
  await page.goto(`${BASE}/admin/support`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const support = await page.evaluate((banned) => ({
    leftover: banned.filter((word) => document.body.innerText.includes(word)),
    user: document.body.innerText.includes("Ứng viên"),
    ent: document.body.innerText.includes("Doanh nghiệp"),
    float: Boolean(document.querySelector("button[aria-label='Mở chat hỗ trợ']")),
  }), BANNED);

  console.log(JSON.stringify({ land, support }, null, 2));
} finally {
  await browser.close();
}
