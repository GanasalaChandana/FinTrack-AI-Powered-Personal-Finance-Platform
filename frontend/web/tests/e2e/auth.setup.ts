/**
 * auth.setup.ts
 * Runs once before all test projects.
 * Logs in and saves browser storage state so tests skip the login screen.
 *
 * Usage: set TEST_EMAIL and TEST_PASSWORD in .env.test (or environment vars).
 * Fallback to demo credentials for local dev.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

const EMAIL    = process.env.TEST_EMAIL    ?? 'test@example.com';
const PASSWORD = process.env.TEST_PASSWORD ?? 'password123';

setup('authenticate', async ({ page }) => {
  // Navigate to the login/register page
  await page.goto('/register?mode=signin');

  // Wait for the page to be ready
  await page.waitForLoadState('networkidle');

  // Fill in credentials — target the email input
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passInput  = page.locator('input[type="password"]').first();

  await emailInput.fill(EMAIL);
  await passInput.fill(PASSWORD);

  // Click sign in button
  const signInBtn = page.locator(
    'button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")'
  ).first();
  await signInBtn.click();

  // Wait for redirect to dashboard — confirms login succeeded
  await page.waitForURL('**/dashboard', { timeout: 15_000 });

  // Confirm we landed on the dashboard
  await expect(page).toHaveURL(/dashboard/);

  // Save storage state (localStorage token + cookies)
  await page.context().storageState({ path: AUTH_FILE });
  console.log('✅ Auth state saved to', AUTH_FILE);
});
