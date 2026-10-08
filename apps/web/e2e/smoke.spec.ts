import { expect, test } from "@playwright/test";

test("landing has skip-link and start CTA", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("link", { name: /Bỏ qua đến nội dung chính|Skip to main content/ })).toBeAttached();
  await expect(page.getByRole("button", { name: /Bắt đầu ngay|Start now/ })).toBeVisible();
});

test("room without sessionId stays empty", async ({ page }) => {
  const response = await page.goto("/interview/room");
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("alert")).toContainText(/Thiếu mã buổi|Missing session code/);
  await expect(page.getByRole("button", { name: /Tắt Micro|Mute/ })).toHaveCount(0);
});

test("jobs route is healthy", async ({ page }) => {
  const response = await page.goto("/jobs");
  expect(response?.status()).toBe(200);
});
