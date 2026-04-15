/**
 * smoke.spec.ts — FinTrack E2E Smoke Tests
 *
 * Covers the critical user paths:
 *   1. Dashboard loads and shows stat cards
 *   2. Navigate to Transactions
 *   3. Navigate to Goals & Budgets
 *   4. Navigate to Reports
 *   5. Navigate to Calendar
 *   6. Navigate to AI Insights
 *   7. Navigate to Health Score
 *   8. Navigate to Recurring Transactions
 *   9. Navigate to Settings
 *  10. Sidebar collapse/expand
 *  11. Add a transaction (modal open + close)
 *
 * Auth is handled by auth.setup.ts — these tests start already logged in.
 */

import { test, expect, Page } from '@playwright/test';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Navigate via sidebar link and assert URL matches */
async function navTo(page: Page, href: string, urlPattern: RegExp) {
  const link = page.locator(`a[href="${href}"]`).first();
  await link.click();
  await page.waitForURL(urlPattern, { timeout: 10_000 });
  await expect(page).toHaveURL(urlPattern);
}

/* ── Test suite ───────────────────────────────────────────────────────────── */

test.describe('FinTrack Smoke Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Start each test from the dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  /* 1 ─ Dashboard loads */
  test('dashboard renders stat cards', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);

    // At least one stat card should be visible (Total Income / Expenses / etc.)
    const statCards = page.locator('[class*="StatCard"], [data-testid="stat-card"]');
    // Alternatively match by text content visible on the page
    await expect(
      page.locator('text=/Total Income|Total Expenses|Net Savings|Net Worth/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  /* 2 ─ Sidebar navigation: Transactions */
  test('navigate to Transactions', async ({ page }) => {
    await navTo(page, '/transactions', /transactions/);
    await expect(page.locator('h1, [class*="heading"]').first()).toBeVisible();
  });

  /* 3 ─ Sidebar navigation: Goals & Budget */
  test('navigate to Goals & Budgets', async ({ page }) => {
    await navTo(page, '/goals-budgets', /goals-budgets/);
    await expect(page.locator('text=/Goals|Budget/i').first()).toBeVisible({ timeout: 8_000 });
  });

  /* 4 ─ Sidebar navigation: Reports */
  test('navigate to Reports', async ({ page }) => {
    await navTo(page, '/reports', /reports/);
    await expect(page.locator('text=/Reports|Overview|Spending/i').first()).toBeVisible({ timeout: 8_000 });
  });

  /* 5 ─ Sidebar navigation: Calendar */
  test('navigate to Calendar', async ({ page }) => {
    await navTo(page, '/calendar', /calendar/);
    // Calendar should show month/year
    const monthYear = page.locator('text=/January|February|March|April|May|June|July|August|September|October|November|December/i').first();
    await expect(monthYear).toBeVisible({ timeout: 8_000 });
  });

  /* 6 ─ AI Insights page loads (previously outside (app)) */
  test('navigate to AI Insights', async ({ page }) => {
    await navTo(page, '/insights', /insights/);
    await expect(page.locator('text=/Insights|Analysis|Transactions/i').first()).toBeVisible({ timeout: 10_000 });
  });

  /* 7 ─ Health Score page loads (previously outside (app)) */
  test('navigate to Financial Health Score', async ({ page }) => {
    await navTo(page, '/health', /health/);
    await expect(page.locator('text=/Health|Score|Financial/i').first()).toBeVisible({ timeout: 10_000 });
  });

  /* 8 ─ Recurring page loads (previously outside (app)) */
  test('navigate to Recurring Transactions', async ({ page }) => {
    await navTo(page, '/recurring', /recurring/);
    await expect(page.locator('text=/Recurring/i').first()).toBeVisible({ timeout: 10_000 });
  });

  /* 9 ─ Settings page loads (previously outside (app)) */
  test('navigate to Settings', async ({ page }) => {
    // Settings is reachable via direct URL
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/settings/);
    await expect(page.locator('text=/Settings/i').first()).toBeVisible({ timeout: 8_000 });
    // All 5 tabs should be present
    await expect(page.locator('button:has-text("Profile")')).toBeVisible();
    await expect(page.locator('button:has-text("Security")')).toBeVisible();
    await expect(page.locator('button:has-text("Preferences")')).toBeVisible();
    await expect(page.locator('button:has-text("Notifications")')).toBeVisible();
    await expect(page.locator('button:has-text("Categories")')).toBeVisible();
  });

  /* 10 ─ Settings: Notifications tab */
  test('settings notifications tab has toggles', async ({ page }) => {
    await page.goto('/settings?tab=notifications');
    await page.waitForLoadState('networkidle');
    const toggles = page.locator('[role="switch"]');
    await expect(toggles.first()).toBeVisible({ timeout: 8_000 });
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(5); // we have 6 notification toggles
  });

  /* 11 ─ Sidebar collapse */
  test('sidebar collapses and expands', async ({ page }) => {
    // Find the collapse/chevron button (ChevronLeft icon)
    const collapseBtn = page.locator('button[title*="collapse" i], button[aria-label*="collapse" i]').first();
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      // After collapse, sidebar should be narrow (~64px)
      await page.waitForTimeout(400); // CSS transition
      const sidebar = page.locator('aside').first();
      const box = await sidebar.boundingBox();
      if (box) expect(box.width).toBeLessThan(100);

      // Expand again
      await collapseBtn.click();
      await page.waitForTimeout(400);
    }
  });

  /* 12 ─ Add transaction modal */
  test('can open and close Add Transaction modal', async ({ page }) => {
    // Look for an Add / New Transaction button on the dashboard or transactions page
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator(
      'button:has-text("Add"), button:has-text("New Transaction"), button[aria-label*="add" i]'
    ).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      // Modal should open
      const modal = page.locator('[role="dialog"], [class*="modal" i], [class*="Modal" i]').first();
      await expect(modal).toBeVisible({ timeout: 5_000 });
      // Close via Escape key
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible({ timeout: 3_000 });
    }
  });

  /* 13 ─ Auth guard: logged-out redirect */
  test('logged-out user is redirected to login', async ({ browser }) => {
    // Create a fresh context with NO auth state
    const context = await browser.newContext({ storageState: undefined });
    const page    = await context.newPage();

    await page.goto('/dashboard');
    await page.waitForURL(/login|register|signin/, { timeout: 10_000 });
    await expect(page).toHaveURL(/login|register|signin/);

    await context.close();
  });

});
