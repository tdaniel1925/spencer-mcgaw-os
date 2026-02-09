import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * Tests all pages and user flows in the Spencer-McGaw Hub application
 *
 * Authentication Setup:
 * - The 'setup' project runs first and logs in with test credentials
 * - Auth state is saved to playwright/.auth/user.json
 * - All other tests reuse this auth state (already logged in)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Setup project - runs authentication once before all tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts$/,
    },
    // Chromium tests - uses saved authentication state
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use saved auth state so all tests run as authenticated user
        storageState: 'playwright/.auth/user.json',
      },
      // This project depends on setup completing first
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
