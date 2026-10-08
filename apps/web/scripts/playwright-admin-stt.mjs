import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { browserLoginPayload } from "../../../scripts/verify-credentials.mjs";

const BASE = "http://localhost:3000";
const WAV = "C:/Users/Admin/Desktop/src/apps/web/.data/verify/stt-vi.wav";

const browser = await chromium.launch({ headless: true });
try {
  const admin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminPage = await admin.newPage();
  await adminPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await adminPage.evaluate(async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!(await response.json().catch(() => null))?.success) throw new Error("admin login");
  }, browserLoginPayload("admin"));
  await adminPage.goto(`${BASE}/admin/support`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await adminPage.waitForTimeout(800);
  const adminSupport = await adminPage.evaluate(() => ({
    path: location.pathname,
    all: document.body.innerText.includes("Tất cả"),
    user: document.body.innerText.includes("Ứng viên"),
    ent: document.body.innerText.includes("Doanh nghiệp"),
    floatingChat: Boolean(document.querySelector("button[aria-label='Mở chat hỗ trợ']")),
  }));

  const user = await browser.newContext();
  const page = await user.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!(await response.json().catch(() => null))?.success) throw new Error("user login");
  }, browserLoginPayload("candidate"));
  const sttStarted = Date.now();
  const sttResponse = await user.request.post(`${BASE}/api/interviews/stt`, {
    multipart: {
      audio: { name: "stt-vi.wav", mimeType: "audio/wav", buffer: readFileSync(WAV) },
      lang: "vi",
    },
  });
  const sttBody = await sttResponse.json().catch(() => null);
  console.log(JSON.stringify({
    adminSupport,
    stt: {
      status: sttResponse.status(),
      ms: Date.now() - sttStarted,
      chars: typeof sttBody?.text === "string" ? sttBody.text.length : 0,
      hasText: Boolean(sttBody?.text),
    },
  }, null, 2));
} finally {
  await browser.close();
}
