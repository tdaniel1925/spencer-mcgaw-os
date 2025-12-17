import { test, expect } from "@playwright/test";

test.describe("SMS Pages", () => {
  test.describe("SMS Main Page", () => {
    test("should load sms page", async ({ page }) => {
      await page.goto("/sms");
      await page.waitForTimeout(1000);
    });
  });

  test.describe("SMS Analytics", () => {
    test("should load sms analytics page", async ({ page }) => {
      await page.goto("/sms/analytics");
      await page.waitForTimeout(1000);
    });
  });

  test.describe("SMS Campaigns", () => {
    test("should load sms campaigns page", async ({ page }) => {
      await page.goto("/sms/campaigns");
      await page.waitForTimeout(1000);
    });
  });
});
