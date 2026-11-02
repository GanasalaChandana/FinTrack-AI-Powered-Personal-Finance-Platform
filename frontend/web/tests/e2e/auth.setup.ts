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
  // Go straight to the sign-in form (/register redirects to sign-UP mode)
  await page.goto('/login?mode=signin');

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput  = page.locator('input[type="password"]').first();
  await expect(emailInput).toBeVisible();

  await emailInput.fill(EMAIL);
  await passInput.fill(PASSWORD);

  // The page has a "Sign In" tab *and* a "Sign In" submit button; the submit
  // button comes last in the page.
  await page.getByRole('button', { name: /^sign in/i }).last().click();

  // Wait for redirect to dashboard — confirms login succeeded. Generous timeout:
  // the free-tier backend can take a minute to wake up.
  await page.waitForURL('**/dashboard', { timeout: 90_000 });

  // Confirm we landed on the dashboard
  await expect(page).toHaveURL(/dashboard/);

  // Save storage state (localStorage token + cookies)
  await page.context().storageState({ path: AUTH_FILE });
  console.log('✅ Auth state saved to', AUTH_FILE);
});
