import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const baseUrl = "http://localhost:3000/";
const outputDir = "C:/Users/Admin/AppData/Local/Temp/pivotassist-react-bits-verify";
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: outputDir },
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.screenshot({ path: `${outputDir}/landing-before.png` });

const tiltedCard = page.locator('[data-react-bits="tilted-card"]');
const tiltedSurface = tiltedCard.locator(":scope > div").first();
const initialTransform = await tiltedSurface.evaluate((element) => getComputedStyle(element).transform);
await tiltedCard.hover({ position: { x: 80, y: 120 } });
await page.waitForTimeout(850);
const hoveredTransform = await tiltedSurface.evaluate((element) => getComputedStyle(element).transform);
await page.screenshot({ path: `${outputDir}/landing-hover.png` });

const analystButton = page.getByRole("button", { name: "Data Analyst", exact: true });
await analystButton.click();
await page.waitForTimeout(400);
const analystQuestion = await page.locator('[aria-live="polite"] p').innerText();
const analystPressed = await analystButton.getAttribute("aria-pressed");

const howItWorks = page.locator("#lo-trinh");
await howItWorks.scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
const howItWorksOpacity = await howItWorks.evaluate((element) => getComputedStyle(element).opacity);

await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(120);
const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.screenshot({ path: `${outputDir}/landing-mobile.png` });

await page.close();

const reducedContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const reducedPage = await reducedContext.newPage();
const reducedErrors = [];
reducedPage.on("pageerror", (error) => reducedErrors.push(error.message));
await reducedPage.goto(baseUrl, { waitUntil: "networkidle" });
await reducedPage.waitForTimeout(250);
const reducedTransform = await reducedPage
  .locator('[data-react-bits="tilted-card"] > div')
  .first()
  .evaluate((element) => getComputedStyle(element).transform);
const reducedQuestion = await reducedPage.locator('[aria-live="polite"] p').innerText();
await reducedContext.close();

await browser.close();

console.log(JSON.stringify({
  initialTransform,
  hoveredTransform,
  tiltChanged: initialTransform !== hoveredTransform,
  analystPressed,
  analystQuestion,
  howItWorksOpacity,
  mobileOverflow,
  reducedTransform,
  reducedQuestion,
  errors,
  reducedErrors,
  outputDir,
}, null, 2));
