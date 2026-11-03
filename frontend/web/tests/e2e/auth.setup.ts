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
import { deleteTestTransactions, API_HEADERS } from './testData';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

// Trim: values pasted into GitHub secrets often carry a trailing newline
const EMAIL    = (process.env.TEST_EMAIL    || 'test@example.com').trim();
const PASSWORD = (process.env.TEST_PASSWORD || 'password123').trim();

setup('authenticate', async ({ page }) => {
  setup.setTimeout(120_000); // default 30s is shorter than a backend wake-up

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

  // Mark onboarding as done so the first-visit wizard doesn't cover every page
  await page.evaluate(() => localStorage.setItem('fintrack-onboarding-done', 'true'));

  // Clear transactions left by earlier runs' add-transaction test
  await deleteTestTransactions(page);

  // The budget tests need at least one budget; a fresh test account has none
  {
    const headers = API_HEADERS;
    const existing = await page.request.get(`/api/budgets`, { headers });
    if (existing.ok() && (await existing.json()).length === 0) {
      const month = new Date().toISOString().slice(0, 7);
      await page.request.post(`/api/budgets`, {
        headers,
        data: { category: 'Food & Dining', budget: 400, spent: 0, icon: '🍔', color: '#f97316', month },
      });
    }
  }

  // Save storage state (session cookies + the stored user profile)
  await page.context().storageState({ path: AUTH_FILE });
  console.log('✅ Auth state saved to', AUTH_FILE);
});
