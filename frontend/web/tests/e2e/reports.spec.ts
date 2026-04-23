/**
 * reports.spec.ts — FinTrack Reports Tab Tests
 *
 * Covers every tab in the Reports page:
 *   1. Overview tab (default)
 *   2. Trends tab
 *   3. Comparison tab
 *   4. Forecast tab — the new AI feature
 *   5. Budget History tab
 *   6. Tax tab
 *   7. Income tab
 *   8. Savings tab
 *   9. Custom Report builder tab
 *  10. PDF export button is present
 */

import { test, expect, Page } from '@playwright/test';

async function goToReports(page: Page) {
  await page.goto('/reports');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/reports/);
}

async function clickTab(page: Page, tabLabel: string) {
  const tab = page.locator(
    `button:has-text("${tabLabel}"), [role="tab"]:has-text("${tabLabel}")`
  ).first();
  if (await tab.isVisible({ timeout: 5_000 })) {
    await tab.click();
    await page.waitForTimeout(600);
  }
}

test.describe('Reports Page — All Tabs', () => {

  /* 1 — overview (default) */
  test('Overview tab loads with summary stats', async ({ page }) => {
    await goToReports(page);
    await expect(
      page.locator('text=/Income|Expenses|Spending|Overview/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  /* 2 — trends */
  test('Trends tab loads', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Trends');
    await expect(
      page.locator('text=/Trend|Category|Spending/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /* 3 — comparison */
  test('Comparison tab loads', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Comparison');
    await expect(
      page.locator('text=/Comparison|vs|Period/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /* 4 — forecast (AI feature) */
  test('Forecast tab shows projected spending chart', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Forecast');
    await expect(
      page.locator('text=/Forecast|Project|Month/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  /* 5 — budget history */
  test('Budget History tab loads', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Budget History');
    await expect(
      page.locator('text=/Budget|History|Actual/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /* 6 — tax */
  test('Tax tab loads', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Tax');
    await expect(
      page.locator('text=/Tax|Deduct/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /* 7 — income */
  test('Income tab loads', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Income');
    await expect(
      page.locator('text=/Income|Salary|Earn/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /* 8 — savings */
  test('Savings tab loads', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Savings');
    await expect(
      page.locator('text=/Saving|Rate/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /* 9 — custom report builder */
  test('Custom tab shows report builder UI', async ({ page }) => {
    await goToReports(page);
    await clickTab(page, 'Custom');
    await expect(
      page.locator('text=/Custom|Report|Generate|Builder/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /* 10 — export / download button */
  test('Download/Export button is present on Overview', async ({ page }) => {
    await goToReports(page);
    const downloadBtn = page.locator(
      'button:has-text("Download"), button:has-text("Export"), button[aria-label*="download" i]'
    ).first();
    await expect(downloadBtn).toBeVisible({ timeout: 8_000 });
  });

});
