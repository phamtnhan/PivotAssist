import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { browserLoginPayload } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";
const outDir = "C:/Users/Admin/Desktop/src/apps/web/.data/verify";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  permissions: ["camera", "microphone"],
});
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
const login = await page.evaluate(async ({ email, password }) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return { status: response.status, ok: response.ok, body: await response.json().catch(() => null) };
}, browserLoginPayload("candidate"));

await page.goto(`${BASE}/interview/setup`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const setupText = await page.locator("body").innerText();
await page.screenshot({ path: `${outDir}/interview-setup.png`, fullPage: true });

await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const jobsText = await page.locator("body").innerText();
await page.screenshot({ path: `${outDir}/jobs.png`, fullPage: true });

await page.goto(`${BASE}/services`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const servicesText = await page.locator("body").innerText();
await page.screenshot({ path: `${outDir}/services.png`, fullPage: true });

await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const homeText = await page.locator("body").innerText();
await page.screenshot({ path: `${outDir}/home.png`, fullPage: true });

await page.goto(`${BASE}/interview`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const interviewHubText = await page.locator("body").innerText();
await page.screenshot({ path: `${outDir}/interview-hub.png`, fullPage: true });

await browser.close();

const result = {
  login: { status: login.status, success: login.body?.success === true },
  setup: {
    hasFaceTime: /FaceTime/i.test(setupText),
    hasLogitech: /Logitech C920/i.test(setupText),
    hasObs: /OBS Virtual/i.test(setupText),
    hasGeminiCopy: /Gemini/i.test(setupText),
    hasHeuristicWhenNoKey: /GEMINI_API_KEY chưa có/i.test(setupText),
    hasEnumerateEmpty: /Không tìm thấy camera|Camera đã kết nối|Chưa nhận được tín hiệu camera|hãy cấp quyền/i.test(setupText),
  },
  jobs: {
    hasEsco: /Chuẩn hóa ESCO/.test(jobsText),
    hasParsedTextLabel: /parsedText/.test(jobsText),
  },
  services: {
    momoGate: /MoMo chưa cấu hình/.test(servicesText),
    fakeStats: /42\.700\+|1\.650\+/.test(servicesText),
  },
  home: {
    hasEscoLevel: /Cấp bậc ESCO/.test(homeText),
  },
  interviewHub: {
    hasTemplateBadge: /Mẫu \(không phải Job live\)|Mẫu luyện tập/.test(interviewHubText),
    hasFakePopular: /Phổ biến nhất/.test(interviewHubText),
  },
  screenshots: [
    `${outDir}/interview-setup.png`,
    `${outDir}/jobs.png`,
    `${outDir}/services.png`,
    `${outDir}/home.png`,
    `${outDir}/interview-hub.png`,
  ],
};
console.log(JSON.stringify(result, null, 2));
