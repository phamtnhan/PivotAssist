import { chromium } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/Admin/.gemini/antigravity/brain/f3c27e5d-90c8-4fbb-a0da-e1645373c379';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/profiles...');
  await page.goto('http://localhost:3000/profiles', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1. Capture Profiles Overview
  const profileOverviewPath = path.join(ARTIFACT_DIR, 'workspace-profiles-refined.png');
  await page.screenshot({ path: profileOverviewPath, fullPage: true });
  console.log('Saved profiles overview to:', profileOverviewPath);

  // 2. Open Export Modal from top button
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const exportBtn = page.locator('button:has-text("Xuất hồ sơ")').first();
  if (await exportBtn.count() > 0) {
    await exportBtn.click();
    await page.waitForTimeout(500);
    const exportModalPath = path.join(ARTIFACT_DIR, 'workspace-profiles-export-modal.png');
    await page.screenshot({ path: exportModalPath });
    console.log('Saved export modal screenshot to:', exportModalPath);
  }

  await browser.close();
}

capture();
