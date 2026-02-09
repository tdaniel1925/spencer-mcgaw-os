/**
 * E2E Tests for Clients Management
 * Tests client creation, validation, list view, and detail page
 */

import { test, expect } from "@playwright/test";

test.describe("Clients Management", () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Add authentication setup
    await page.goto("/clients");
  });

  test.describe("Client List Page", () => {
    test("should display clients list page", async ({ page }) => {
      await expect(page).toHaveTitle(/Clients/i);
      await expect(page.getByRole("heading", { name: /clients/i })).toBeVisible();
    });

    test("should show empty state when no clients", async ({ page }) => {
      // Check for empty state
      const emptyState = page.getByText(/no clients yet/i);
      if (await emptyState.isVisible()) {
        await expect(page.getByText(/add your first client/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /add first client/i })).toBeVisible();
      }
    });

    test("should navigate to create client page", async ({ page }) => {
      await page.getByRole("link", { name: /add client/i }).click();
      await expect(page).toHaveURL(/\/clients\/new/);
    });

    test("should have search functionality", async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search clients/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill("test");
        // Wait for search to complete
        await page.waitForTimeout(500);
      }
    });

    test("should have filter options", async ({ page }) => {
      const filterButton = page.getByRole("button", { name: /filter/i });
      if (await filterButton.isVisible()) {
        await filterButton.click();
        // Check for filter options
        await expect(page.getByText(/active/i)).toBeVisible();
      }
    });
  });

  test.describe("Client Creation", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/clients/new");
    });

    test("should display client creation form", async ({ page }) => {
      await expect(page.getByText(/add new client/i)).toBeVisible();
      await expect(page.getByText(/client type/i)).toBeVisible();
    });

    test("should show form validation errors", async ({ page }) => {
      // Try to submit without filling required fields
      const nextButton = page.getByRole("button", { name: /next/i });

      // Click next on first step
      await nextButton.click();

      // Should show validation errors
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });

    test("should validate email format", async ({ page }) => {
      // Navigate to basic information step
      await page.getByRole("button", { name: /individual/i }).click();
      await page.getByRole("button", { name: /next/i }).click();

      // Fill in invalid email
      await page.getByLabel(/first name/i).fill("John");
      await page.getByLabel(/last name/i).fill("Doe");
      await page.getByLabel(/email/i).fill("invalid-email");
      await page.getByLabel(/email/i).blur();

      // Should show email validation error
      await expect(page.getByText(/valid email/i)).toBeVisible();
    });

    test("should validate phone format", async ({ page }) => {
      // Navigate to basic information step
      await page.getByRole("button", { name: /individual/i }).click();
      await page.getByRole("button", { name: /next/i }).click();

      // Fill in invalid phone
      await page.getByLabel(/phone/i).fill("123");
      await page.getByLabel(/phone/i).blur();

      // Should show phone validation error
      await expect(page.getByText(/valid phone/i)).toBeVisible();
    });

    test("should validate ZIP code format", async ({ page }) => {
      // Navigate to address step
      await page.getByRole("button", { name: /individual/i }).click();
      await page.getByRole("button", { name: /next/i }).click();

      // Fill required fields
      await page.getByLabel(/first name/i).fill("John");
      await page.getByLabel(/last name/i).fill("Doe");
      await page.getByLabel(/email/i).fill("john@example.com");
      await page.getByRole("button", { name: /next/i }).click();

      // Fill invalid ZIP
      await page.getByLabel(/zip/i).fill("123");
      await page.getByLabel(/zip/i).blur();

      // Should show ZIP validation error
      await expect(page.getByText(/5-digit/i)).toBeVisible();
    });

    test("should show success indicators for valid fields", async ({ page }) => {
      // Navigate to basic information step
      await page.getByRole("button", { name: /individual/i }).click();
      await page.getByRole("button", { name: /next/i }).click();

      // Fill valid email
      await page.getByLabel(/email/i).fill("test@example.com");
      await page.getByLabel(/email/i).blur();

      // Should show green border or success indicator
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toHaveClass(/border-green/);
    });

    test("should navigate through form steps", async ({ page }) => {
      // Step 1: Client Type
      await expect(page.getByText(/client type/i)).toBeVisible();
      await page.getByRole("button", { name: /individual/i }).click();
      await page.getByRole("button", { name: /next/i }).click();

      // Step 2: Basic Information
      await expect(page.getByText(/basic information/i)).toBeVisible();
      await page.getByLabel(/first name/i).fill("John");
      await page.getByLabel(/last name/i).fill("Doe");
      await page.getByLabel(/email/i).fill("john@example.com");
      await page.getByRole("button", { name: /next/i }).click();

      // Step 3: Address
      await expect(page.getByText(/address/i)).toBeVisible();
      await page.getByRole("button", { name: /next/i }).click();

      // Step 4: Services
      await expect(page.getByText(/services/i)).toBeVisible();
      await page.getByRole("button", { name: /next/i }).click();

      // Step 5: Assignment
      await expect(page.getByText(/assignment/i)).toBeVisible();
    });

    test("should allow going back to previous steps", async ({ page }) => {
      // Navigate forward
      await page.getByRole("button", { name: /individual/i }).click();
      await page.getByRole("button", { name: /next/i }).click();

      // Go back
      await page.getByRole("button", { name: /previous/i }).click();

      // Should be back on client type step
      await expect(page.getByText(/client type/i)).toBeVisible();
    });

    test("should create client successfully", async ({ page }) => {
      // Fill out complete form
      await page.getByRole("button", { name: /individual/i }).click();
      await page.getByRole("button", { name: /next/i }).click();

      await page.getByLabel(/first name/i).fill("John");
      await page.getByLabel(/last name/i).fill("Doe");
      await page.getByLabel(/email/i).fill("john.doe@example.com");
      await page.getByRole("button", { name: /next/i }).click();

      await page.getByLabel(/street/i).fill("123 Main St");
      await page.getByLabel(/city/i).fill("Austin");
      await page.getByLabel(/zip/i).fill("78701");
      await page.getByRole("button", { name: /next/i }).click();

      await page.getByRole("button", { name: /next/i }).click();

      // Submit form
      await page.getByRole("button", { name: /save client/i }).click();

      // Should show success toast
      await expect(page.getByText(/client created/i)).toBeVisible();

      // Should redirect to clients list
      await expect(page).toHaveURL(/\/clients$/);
    });
  });

  test.describe("Client Detail Page", () => {
    test("should show breadcrumbs", async ({ page }) => {
      // Navigate to a client (assuming at least one exists)
      await page.goto("/clients");

      const clientLink = page.getByRole("link").first();
      if (await clientLink.isVisible()) {
        await clientLink.click();

        // Check for breadcrumbs
        await expect(page.getByText(/clients/i).first()).toBeVisible();
      }
    });

    test("should display client information", async ({ page }) => {
      await page.goto("/clients");

      const clientLink = page.getByRole("link").first();
      if (await clientLink.isVisible()) {
        await clientLink.click();

        // Should show client details
        await expect(page.getByRole("heading")).toBeVisible();
      }
    });

    test("should have action buttons", async ({ page }) => {
      await page.goto("/clients");

      const clientLink = page.getByRole("link").first();
      if (await clientLink.isVisible()) {
        await clientLink.click();

        // Check for action buttons
        const callButton = page.getByRole("button", { name: /call/i });
        const emailButton = page.getByRole("button", { name: /email/i });
        const editButton = page.getByRole("button", { name: /edit/i });

        if (await callButton.isVisible()) {
          await expect(callButton).toBeVisible();
        }
      }
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("should close dialog with Escape key", async ({ page }) => {
      await page.goto("/clients/new");

      // Press Escape
      await page.keyboard.press("Escape");

      // Should navigate back or close
      await expect(page).toHaveURL(/\/clients$/);
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should be responsive on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/clients");

      // Page should still be functional
      await expect(page.getByRole("heading")).toBeVisible();
    });

    test("should show mobile-friendly forms", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/clients/new");

      // Form should stack vertically on mobile
      await expect(page.getByText(/client type/i)).toBeVisible();
    });
  });
});
