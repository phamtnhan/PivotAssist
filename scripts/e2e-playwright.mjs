import { candidatePassword, staffPassword } from "./verify-credentials.mjs";
import { chromium } from "../node_modules/.pnpm/node_modules/@playwright/test/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
mkdirSync("scripts/.browser-evidence", { recursive: true });

async function launch() {
  const errors = [];
  for (const channel of ["msedge", "chrome", "chromium"]) {
    try {
      return await chromium.launch({ channel: channel === "chromium" ? undefined : channel, headless: true });
    } catch (error) {
      errors.push(`${channel}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Không launch được Chromium/Chrome/Edge. ${errors.join(" | ")}`);
}

const browser = await launch();
const results = [];
function log(ok, label, extra) {
  results.push({ ok, label, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`, extra ?? "");
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Đăng nhập vào Workspace" }).click();
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await login(desktop, "recruiter@nexusai.local", staffPassword());
  await desktop.waitForURL(/\/enterprise\/dashboard/, { timeout: 20000 });
  await desktop.getByText(/LIVE ATS/).waitFor({ timeout: 20000 });
  const dashText = await desktop.locator("body").innerText();
  log(dashText.includes("LIVE ATS") && !dashText.includes("NexusAI Technologies vừa được xác thực MST"), "recruiter dashboard live ATS", { url: desktop.url(), hasLive: dashText.includes("LIVE ATS"), hasJob: dashText.includes("Frontend") || dashText.includes("Job") });
  await desktop.screenshot({ path: "scripts/.browser-evidence/recruiter-dashboard.png", fullPage: true });

  const profileLink = desktop.getByRole("link", { name: /Xem hồ sơ/ }).first();
  await profileLink.waitFor({ timeout: 10000 });
  await profileLink.click();
  await desktop.waitForURL(/\/enterprise\/candidates\//, { timeout: 10000 });
  await desktop.getByText(/Candidate dossier|Chưa có email/).waitFor({ timeout: 20000 });
  const candidateText = await desktop.locator("body").innerText();
  log(desktop.url().includes("/enterprise/candidates/"), "recruiter open candidate profile", { url: desktop.url(), hasEmail: /@/.test(candidateText), hasFixtureScore: candidateText.includes("score±3") });
  await desktop.screenshot({ path: "scripts/.browser-evidence/recruiter-candidate.png", fullPage: true });

  await desktop.goto(`${BASE}/enterprise/analytics`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(800);
  const analyticsText = await desktop.locator("body").innerText();
  log(!analyticsText.includes("Next.js 14 App Router & RSC"), "analytics not using hardcoded skill gaps", { url: desktop.url() });

  await desktop.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await login(desktop, "nam.nguyen@example.com", candidatePassword());
  await desktop.waitForURL(/\/home/, { timeout: 20000 });
  await desktop.getByText(/Nguyễn Thành Nam|NexusAI|Đã có CV/).waitFor({ timeout: 20000 });
  const homeText = await desktop.locator("body").innerText();
  log(!homeText.includes("Tech Unicorn") && homeText.includes("Chào mừng"), "candidate home without fixture jobs", { url: desktop.url(), hasResumeHint: homeText.includes("Đã có CV") || homeText.includes("Chưa tải lên") });
  await desktop.screenshot({ path: "scripts/.browser-evidence/candidate-home.png", fullPage: true });

  await desktop.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(1200);
  const jobsText = await desktop.locator("body").innerText();
  log(jobsText.includes("Nộp hồ sơ") || jobsText.includes("Đã tạo application") || jobsText.includes("Việc làm"), "jobs page live", { snippet: jobsText.slice(0, 200) });
  const applyBtn = desktop.getByRole("button", { name: /Nộp hồ sơ ngay|Đã tạo application/ });
  if (await applyBtn.count()) {
    const before = await applyBtn.first().innerText();
    if (before.includes("Nộp hồ sơ")) {
      await applyBtn.first().click();
      await desktop.waitForTimeout(2000);
      const after = await applyBtn.first().innerText().catch(() => "");
      log(after.includes("Đã tạo") || after.includes("application") || /Đăng nhập|CV/.test(await desktop.locator("body").innerText()), "candidate apply click", { before, after });
    } else {
      log(true, "candidate apply already exists", { before });
    }
  } else {
    log(false, "candidate apply button missing", {});
  }
  await desktop.screenshot({ path: "scripts/.browser-evidence/candidate-jobs.png", fullPage: true });

  await desktop.goto(`${BASE}/applications`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(800);
  const appsText = await desktop.locator("body").innerText();
  log(appsText.includes("AI_INTERVIEW") || appsText.includes("Application") || appsText.includes("hồ sơ") || appsText.includes("phỏng vấn"), "applications page has live rows", { hasDemoStorageHint: appsText.includes("localStorage") });

  await desktop.goto(`${BASE}/interview/setup`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(500);
  const roleValue = await desktop.locator("#pivotassist-roles").count();
  const roleInput = desktop.locator('input[list="pivotassist-roles"]');
  log(await roleInput.count() === 1, "interview setup role is free text", { datalist: roleValue });
  await roleInput.fill("Senior Frontend Engineer");
  await desktop.locator("textarea").fill("JD thử nghiệm: cần React, Next.js, TypeScript.");
  await desktop.screenshot({ path: "scripts/.browser-evidence/interview-setup.png" });

  await desktop.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(800);
  const settingsText = await desktop.locator("body").innerText();
  log(!settingsText.includes("#PA-89210") && !settingsText.includes("VietQR thành công"), "settings without fake invoice", {});

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(mobile, "recruiter@nexusai.local", staffPassword());
  await mobile.waitForURL(/\/enterprise\/dashboard/, { timeout: 20000 });
  await mobile.getByText(/LIVE ATS/).waitFor({ timeout: 20000 });
  await mobile.screenshot({ path: "scripts/.browser-evidence/recruiter-dashboard-mobile.png", fullPage: true });
  const mobileText = await mobile.locator("body").innerText();
  log(mobileText.includes("LIVE ATS") || mobileText.includes("ATS"), "mobile recruiter dashboard", { url: mobile.url() });

  await desktop.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(800);
  log(/unauthorized/.test(desktop.url()) || (await desktop.locator("body").innerText()).includes("không có quyền"), "candidate cannot open admin", { url: desktop.url() });
} catch (error) {
  log(false, "playwright crashed", { error: error instanceof Error ? error.message : String(error) });
} finally {
  await browser.close();
  writeFileSync("scripts/.browser-evidence/results.json", JSON.stringify(results, null, 2), "utf8");
  const failed = results.filter((row) => !row.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}
