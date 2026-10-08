import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { browserLoginPayload } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";
const outDir = "C:/Users/Admin/Desktop/src/apps/web/.data/verify";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
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

const persist = await page.evaluate(async () => {
  const response = await fetch("/api/interviews/cmtu82yer000bv0044vyyedkp/report", { cache: "no-store", credentials: "include" });
  const body = await response.json().catch(() => null);
  return {
    status: response.status,
    evaluationStatus: body?.report?.evaluationStatus ?? null,
    provider: body?.report?.score?.modelName ?? null,
    overallScore: body?.report?.score?.overallScore ?? null,
    sessionStatus: body?.report?.sessionStatus ?? null,
    leaked: /AIza|AQ\.Ab8|GEMINI_API_KEY=/.test(JSON.stringify(body)),
  };
});

await page.goto(`${BASE}/interview/report/cmtu82yer000bv0044vyyedkp`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const reportText = await page.locator("body").innerText();
await page.screenshot({ path: `${outDir}/interview-report.png`, fullPage: true });

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const landingText = await page.locator("body").innerText();
await page.screenshot({ path: `${outDir}/landing.png`, fullPage: true });

await browser.close();

console.log(JSON.stringify({
  login: { status: login.status, success: login.body?.success === true },
  persist,
  reportPage: {
    hasScore: /\b35\b/.test(reportText) || /35/.test(reportText),
    hasGemini: /gemini/i.test(reportText),
    hasReady: /READY|sẵn sàng|hoàn tất|điểm/i.test(reportText),
  },
  landing: {
    hasEscoNav: /Chuẩn ESCO/.test(landingText),
    hasEscoCompliant: /ESCO Compliant/.test(landingText),
    hasEscoReport: /Báo cáo chuẩn ESCO/.test(landingText),
  },
}, null, 2));
