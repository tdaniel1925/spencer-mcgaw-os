import { test, expect } from "@playwright/test";

test.describe("Full Page Views", () => {
  test.describe("Kanban Board", () => {
    test("should load kanban page", async ({ page }) => {
      await page.goto("/kanban");
      await page.waitForTimeout(1000);
    });
  });

  test.describe("My Board", () => {
    test("should load my-board page", async ({ page }) => {
      await page.goto("/my-board");
      await page.waitForTimeout(1000);
    });
  });

  test.describe("Task Pool Board", () => {
    test("should load taskpool-board page", async ({ page }) => {
      await page.goto("/taskpool-board");
      await page.waitForTimeout(1000);
    });
  });
});
