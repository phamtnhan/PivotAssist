import { candidatePassword, staffPassword } from "../../../scripts/verify-credentials.mjs";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const ROOM = "cmtunz5og001mv0kgivk2xne9";

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async ({ email: e, password: p }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: e, password: p }),
    });
    const body = await response.json().catch(() => null);
    return { ok: Boolean(body?.success), role: body?.user?.role ?? null };
  }, { email, password });
  if (!result.ok) throw new Error(`login failed ${email}`);
  return result;
}

async function joinRoom(page, label) {
  await page.goto(`${BASE}/face-to-face/${ROOM}`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => document.body.innerText.includes("Đã vào phòng"), { timeout: 40_000 });
  } catch (error) {
    const text = await page.locator("body").innerText().catch(() => "");
    throw new Error(`${label} join failed: ${text.slice(0, 500)}\n${error}`);
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

const grantConsent = () => {
  window.localStorage.setItem("pivotassist:media-consent", JSON.stringify({ "camera-mic": true, mic: true }));
};
const recruiter = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["camera", "microphone"],
});
const candidate = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["camera", "microphone"],
});
await recruiter.addInitScript(grantConsent);
await candidate.addInitScript(grantConsent);
const recruiterPage = await recruiter.newPage();
const candidatePage = await candidate.newPage();

try {
  await login(recruiterPage, "recruiter@nexusai.local", staffPassword());
  await login(candidatePage, "nam.nguyen@example.com", candidatePassword());
  await joinRoom(recruiterPage, "recruiter");
  await joinRoom(candidatePage, "candidate");
  await recruiterPage.waitForFunction(() => /2 người|Nguyễn Hoàng Quỳnh/.test(document.body.innerText), { timeout: 20_000 });
  await candidatePage.waitForFunction(() => /2 người|Phạm Thành Nhân/.test(document.body.innerText), { timeout: 20_000 });
  const recruiterText = await recruiterPage.locator("body").innerText();
  const candidateText = await candidatePage.locator("body").innerText();
  const leftoverRec = ["STAR", "JD", "ATS", "Tạo phòng phỏng vấn"].filter((w) => recruiterText.includes(w));
  const leftoverCan = ["STAR", "JD", "ATS", "Tạo phòng phỏng vấn"].filter((w) => candidateText.includes(w));
  console.log(JSON.stringify({
    recruiter: {
      twoPeople: recruiterText.includes("2 người"),
      seesCandidate: recruiterText.includes("Nguyễn Hoàng Quỳnh"),
      joined: recruiterText.includes("Đã vào phòng"),
      leftover: leftoverRec,
    },
    candidate: {
      twoPeople: candidateText.includes("2 người"),
      seesRecruiter: candidateText.includes("Phạm Thành Nhân"),
      joined: candidateText.includes("Đã vào phòng"),
      createLabel: candidateText.includes("Tạo phòng phỏng vấn"),
      leftover: leftoverCan,
    },
  }, null, 2));
} finally {
  await browser.close();
}
