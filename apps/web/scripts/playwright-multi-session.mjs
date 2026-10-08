import { chromium } from "@playwright/test";
import { browserLoginPayload } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const login = await page.evaluate(async ({ email, password }) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return response.json().catch(() => null);
}, browserLoginPayload("candidate"));
if (!login?.success) throw new Error("login failed");

const run = async (n) => page.evaluate(async (count) => {
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: count }, async () => {
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
    return { status: response.status, ms: Date.now() - t0, ok: Boolean(payload?.session?.id) };
  }));
  return {
    wallMs: Date.now() - started,
    ok: results.filter((row) => row.ok).length,
    times: results.map((row) => row.ms),
    pMax: Math.max(...results.map((row) => row.ms)),
  };
}, n);

const first = await run(8);
const second = await run(8);
console.log(JSON.stringify({ first, second }, null, 2));
await browser.close();
