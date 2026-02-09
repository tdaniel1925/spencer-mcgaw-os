/**
 * Playwright Authentication Setup
 * Logs in once before running tests and saves auth state
 * This allows all E2E tests to run as an authenticated user
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  console.log('🔐 Setting up authentication...');

  // Go to login page
  await page.goto('/login');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Fill in login form with test credentials
  const emailInput = page.locator('input[type="email"], input[name="email"], input#email');
  const passwordInput = page.locator('input[type="password"], input[name="password"], input#password');

  await emailInput.fill(process.env.TEST_USER_EMAIL || 'test@example.com');
  await passwordInput.fill(process.env.TEST_USER_PASSWORD || 'testpassword123');

  // Click sign in button
  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.click();

  // Wait for navigation to dashboard (successful login)
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  // Verify we're logged in by checking for dashboard content
  await expect(page.getByRole('heading')).toBeVisible();

  console.log('✅ Authentication successful - saving state');

  // Save authentication state to file
  await page.context().storageState({ path: authFile });

  console.log(`💾 Auth state saved to ${authFile}`);
});
