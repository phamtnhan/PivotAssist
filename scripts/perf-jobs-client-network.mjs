/**
 * Count client /api/jobs* requests on GET /jobs (guest, no cookies).
 * Usage: node scripts/perf-jobs-client-network.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const api = [];
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("/api/")) api.push({ method: req.method(), url: url.replace(base, "") });
});
const t0 = Date.now();
const response = await page.goto(`${base}/jobs`, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(1500);
const navMs = Date.now() - t0;
const chrome = await page.evaluate(() => ({
  phong: Boolean(Array.from(document.querySelectorAll("a")).find((a) => /Phòng phỏng vấn|Interview room/i.test(a.textContent || ""))),
  jobHeadings: document.querySelectorAll("h3").length,
}));
const report = {
  generated_at: new Date().toISOString(),
  status: response?.status() ?? null,
  nav_ms: navMs,
  listing_get: api.filter((row) => /^GET \/api\/jobs(\?|$)/.test(row.url) || row.url === "/api/jobs"),
  detail_get: api.filter((row) => /^GET \/api\/jobs\//.test(row.url)),
  other_api: api.filter((row) => !row.url.startsWith("/api/jobs")),
  all_api: api,
  chrome,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
