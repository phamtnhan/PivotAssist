import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const BANNED = ["STAR", "JD", "ATS", "Master CV"];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(500);
const landing = await page.evaluate((banned) => {
  const text = document.body.innerText;
  return {
    leftover: banned.filter((word) => text.includes(word)),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    waste: /AI chỉ dùng micro|Camera dành cho/.test(text),
    fakeStats: /65%|94%|120\+/.test(text),
    chat: Boolean(document.querySelector("button[aria-label='Mở chat hỗ trợ']")),
    title: document.title,
  };
}, BANNED);

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/legal`, { waitUntil: "domcontentloaded" });
const legal = await page.evaluate(() => ({
  title: document.title,
  mic: /micro/i.test(document.body.innerText),
  camera: /camera/i.test(document.body.innerText),
  law: /An toàn thông tin mạng|Cybersecurity/i.test(document.body.innerText),
  leftover: ["STAR", "JD", "ATS"].filter((word) => document.body.innerText.includes(word)),
}));

console.log(JSON.stringify({ landing, legal }, null, 2));
await browser.close();
