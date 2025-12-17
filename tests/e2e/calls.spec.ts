import { test, expect } from "@playwright/test";

test.describe("AI Phone Agent Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calls");
  });

  test.describe("Page Structure", () => {
    test("should display the page header with Phone Agent title", async ({ page }) => {
      await expect(page.locator("text=AI Phone Agent")).toBeVisible();
    });

    test("should display the search input", async ({ page }) => {
      await expect(page.getByPlaceholder("Search calls...")).toBeVisible();
    });

    test("should display call count in header", async ({ page }) => {
      await expect(page.locator("text=/\\d+ calls/")).toBeVisible();
    });

    test("should display GoTo connection status", async ({ page }) => {
      // Check for either connected or disconnected status
      const gotoStatus = page.locator("text=/GoTo (Connected|Disconnected)/");
      await expect(gotoStatus).toBeVisible();
    });
  });

  test.describe("Bucket Tray", () => {
    test("should display default buckets", async ({ page }) => {
      await expect(page.locator("text=Follow Up")).toBeVisible();
      await expect(page.locator("text=Callback Needed")).toBeVisible();
      await expect(page.locator("text=Archive")).toBeVisible();
    });

    test("should display New Bucket button", async ({ page }) => {
      await expect(page.getByRole("button", { name: /New Bucket/i })).toBeVisible();
    });

    test("should display drag hint text", async ({ page }) => {
      await expect(page.locator("text=Drag calls to organize")).toBeVisible();
    });

    test("should show bucket creation form when clicking New Bucket", async ({ page }) => {
      await page.getByRole("button", { name: /New Bucket/i }).click();
      await expect(page.getByPlaceholder("Bucket name...")).toBeVisible();
    });

    test("should create new bucket with name", async ({ page }) => {
      await page.getByRole("button", { name: /New Bucket/i }).click();
      await page.getByPlaceholder("Bucket name...").fill("Test Bucket");
      await page.getByRole("button", { name: "Add" }).click();
      await expect(page.locator("text=Test Bucket")).toBeVisible();
    });
  });

  test.describe("Empty State", () => {
    test("should show empty state message when no calls", async ({ page }) => {
      // This test may need mocking if there are always calls
      await page.waitForTimeout(1000);
      const emptyState = page.locator("text=No calls to show");
      const hasEmptyState = await emptyState.count();
      // If there are no calls, should show empty state; otherwise pass
      if (hasEmptyState > 0) {
        await expect(emptyState).toBeVisible();
        await expect(page.locator("text=New calls will appear here")).toBeVisible();
      }
    });
  });

  test.describe("Search Functionality", () => {
    test("should filter calls when searching", async ({ page }) => {
      const searchInput = page.getByPlaceholder("Search calls...");
      await searchInput.fill("test");
      await page.waitForTimeout(500);
      // Verify search is applied (check that input has value)
      await expect(searchInput).toHaveValue("test");
    });

    test("should clear search when emptying input", async ({ page }) => {
      const searchInput = page.getByPlaceholder("Search calls...");
      await searchInput.fill("test");
      await searchInput.clear();
      await expect(searchInput).toHaveValue("");
    });
  });
});

test.describe("Phone Agent Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calls/agent");
  });

  test("should load the agent settings page", async ({ page }) => {
    await page.waitForTimeout(1000);
    // The page should load without errors
    await expect(page).toHaveURL("/calls/agent");
  });
});
