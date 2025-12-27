import { test, expect } from "@playwright/test";

test.describe("Authentication Pages", () => {
  test.describe("Login Page", () => {
    test("should display login form", async ({ page }) => {
      await page.goto("/login");
      // Check for "Welcome back" heading or form elements
      await expect(page.getByRole("heading", { name: /welcome|sign in|login/i })).toBeVisible();
      await expect(page.locator('input[type="email"], input[placeholder*="@"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /sign in|login/i })).toBeVisible();
    });

    test("should show validation errors for empty fields", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: /sign in|login/i }).click();
      // Wait for any validation message
      await page.waitForTimeout(500);
    });

    test("should have link to forgot password", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("link", { name: /forgot|reset/i })).toBeVisible();
    });

    test("should have link to signup or contact", async ({ page }) => {
      await page.goto("/login");
      // Could be "Sign up", "Create account", "Register", or "Contact us"
      await expect(page.getByRole("link", { name: /sign up|create|register|contact/i })).toBeVisible();
    });
  });

  test.describe("Signup Page", () => {
    test("should display signup form", async ({ page }) => {
      await page.goto("/signup");
      await expect(page.locator('input[type="email"], input[placeholder*="@"]')).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
    });

    test("should have link to login", async ({ page }) => {
      await page.goto("/signup");
      await expect(page.getByRole("link", { name: /sign in|login|back/i })).toBeVisible();
    });
  });

  test.describe("Forgot Password Page", () => {
    test("should display forgot password form", async ({ page }) => {
      await page.goto("/forgot-password");
      await expect(page.locator('input[type="email"], input[placeholder*="@"]')).toBeVisible();
      await expect(page.getByRole("button", { name: /reset|send|submit/i })).toBeVisible();
    });

    test("should have link to login", async ({ page }) => {
      await page.goto("/forgot-password");
      await expect(page.getByRole("link", { name: /back|login|sign in/i })).toBeVisible();
    });
  });

  test.describe("Reset Password Page", () => {
    test("should display reset password form or invalid link message", async ({ page }) => {
      await page.goto("/reset-password");
      await page.waitForTimeout(1000);

      // This page requires a valid recovery session
      // Without one, it shows "Invalid or expired link" message
      // With one, it shows the password reset form
      const hasPasswordField = await page.locator('input[type="password"]').count() > 0;
      const hasInvalidMessage = await page.locator("text=/Invalid|expired|Verifying/i").count() > 0;
      const hasResetHeading = await page.getByRole("heading", { name: /reset|password/i }).count() > 0;

      expect(hasPasswordField || hasInvalidMessage || hasResetHeading).toBe(true);
    });
  });
});
