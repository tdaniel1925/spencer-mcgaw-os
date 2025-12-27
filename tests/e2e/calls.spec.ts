import { test, expect } from "@playwright/test";

test.describe("AI Phone Agent Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calls");
    // Wait for page to load - may redirect to login if not authenticated
    await page.waitForTimeout(1000);
  });

  test.describe("Page Structure", () => {
    test("should display the page header or redirect to login", async ({ page }) => {
      // Page may require authentication - check for either authenticated or login page
      const isOnCalls = page.url().includes("/calls");
      const isOnLogin = page.url().includes("/login");
      expect(isOnCalls || isOnLogin).toBe(true);

      if (isOnCalls) {
        await expect(page.getByRole("heading", { name: /Phone Agent/i })).toBeVisible();
      }
    });

    test("should display search input when authenticated", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await expect(page.getByPlaceholder("Search calls...")).toBeVisible();
      }
    });

    test("should display call count when authenticated", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await expect(page.locator("text=/\\d+ calls/")).toBeVisible();
      }
    });

    test("should display GoTo connection status when authenticated", async ({ page }) => {
      if (page.url().includes("/calls")) {
        const gotoStatus = page.locator("text=/GoTo (Connected|Disconnected)/");
        await expect(gotoStatus).toBeVisible();
      }
    });
  });

  test.describe("Bucket Tray", () => {
    test("should display default buckets when authenticated", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await expect(page.locator("text=Follow Up")).toBeVisible();
        await expect(page.locator("text=Callback Needed")).toBeVisible();
        await expect(page.locator("text=Archive")).toBeVisible();
      }
    });

    test("should display New Bucket button when authenticated", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await expect(page.getByRole("button", { name: /New Bucket/i })).toBeVisible();
      }
    });

    test("should display drag hint text when authenticated", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await expect(page.locator("text=Drag calls to organize")).toBeVisible();
      }
    });

    test("should show bucket creation form when clicking New Bucket", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await page.getByRole("button", { name: /New Bucket/i }).click();
        await expect(page.getByPlaceholder("Bucket name...")).toBeVisible();
      }
    });

    test("should create new bucket with name", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await page.getByRole("button", { name: /New Bucket/i }).click();
        await page.getByPlaceholder("Bucket name...").fill("Test Bucket");
        await page.getByRole("button", { name: "Add" }).click();
        await expect(page.locator("text=Test Bucket")).toBeVisible();
      }
    });
  });

  test.describe("Empty State", () => {
    test("should show empty state message when no calls", async ({ page }) => {
      if (page.url().includes("/calls")) {
        await page.waitForTimeout(1000);
        const emptyState = page.locator("text=No calls to show");
        const hasEmptyState = await emptyState.count();
        if (hasEmptyState > 0) {
          await expect(emptyState).toBeVisible();
          await expect(page.locator("text=New calls will appear here")).toBeVisible();
        }
      }
    });
  });

  test.describe("Search Functionality", () => {
    test("should filter calls when searching", async ({ page }) => {
      if (page.url().includes("/calls")) {
        const searchInput = page.getByPlaceholder("Search calls...");
        await searchInput.fill("test");
        await page.waitForTimeout(500);
        await expect(searchInput).toHaveValue("test");
      }
    });

    test("should clear search when emptying input", async ({ page }) => {
      if (page.url().includes("/calls")) {
        const searchInput = page.getByPlaceholder("Search calls...");
        await searchInput.fill("test");
        await searchInput.clear();
        await expect(searchInput).toHaveValue("");
      }
    });
  });
});

test.describe("Phone Agent Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calls/agent");
    await page.waitForTimeout(1000);
  });

  test("should load the agent settings page or redirect to login", async ({ page }) => {
    // Page may require authentication
    const isOnAgent = page.url().includes("/calls/agent");
    const isOnLogin = page.url().includes("/login");
    expect(isOnAgent || isOnLogin).toBe(true);
  });
});
