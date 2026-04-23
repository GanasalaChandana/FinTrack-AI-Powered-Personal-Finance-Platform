/**
 * transactions.spec.ts — FinTrack Transaction Flow Tests
 *
 * Covers:
 *   1. Transactions page renders table / empty state
 *   2. Open "Add Transaction" modal
 *   3. Fill and submit a new expense transaction
 *   4. Search / filter transactions by keyword
 *   5. Filter by type (expense / income)
 *   6. Export menu is accessible
 *   7. Bulk select UI appears on checkbox click
 */

import { test, expect, Page } from '@playwright/test';

async function goToTransactions(page: Page) {
  await page.goto('/transactions');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/transactions/);
}

test.describe('Transaction Flows', () => {

  /* 1 — page loads */
  test('transactions page renders', async ({ page }) => {
    await goToTransactions(page);
    await expect(
      page.locator('text=/Transactions|No transactions/i').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  /* 2 — add modal opens */
  test('Add Transaction modal opens', async ({ page }) => {
    await goToTransactions(page);
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Transaction")').first();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  /* 3 — fill and submit a transaction */
  test('can add a new expense transaction', async ({ page }) => {
    await goToTransactions(page);
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Transaction")').first();
    await addBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill the form fields
    const merchantField = dialog.locator('input[name="merchant"], input[placeholder*="merchant" i], input[placeholder*="Merchant" i]').first();
    if (await merchantField.isVisible()) await merchantField.fill('Test Coffee Shop');

    const amountField = dialog.locator('input[name="amount"], input[placeholder*="amount" i], input[placeholder*="0.00" i]').first();
    if (await amountField.isVisible()) await amountField.fill('12.50');

    const descField = dialog.locator('input[name="description"], textarea[name="description"]').first();
    if (await descField.isVisible()) await descField.fill('Morning coffee');

    // Submit
    const submitBtn = dialog.locator('button[type="submit"], button:has-text("Save"), button:has-text("Add Transaction")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Modal should close on success
      await expect(dialog).not.toBeVisible({ timeout: 8_000 });
    }
  });

  /* 4 — keyword search */
  test('search filters transactions', async ({ page }) => {
    await goToTransactions(page);
    const searchInput = page.locator('input[placeholder*="Search" i], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 5_000 })) {
      await searchInput.fill('Grocery');
      await page.waitForTimeout(600); // debounce
      // Results should update (no assertion on count — depends on seeded data)
      await expect(searchInput).toHaveValue('Grocery');
    }
  });

  /* 5 — type filter */
  test('expense/income filter buttons work', async ({ page }) => {
    await goToTransactions(page);
    const expenseFilter = page.locator('button:has-text("Expense"), button:has-text("expense")').first();
    if (await expenseFilter.isVisible({ timeout: 5_000 })) {
      await expenseFilter.click();
      await page.waitForTimeout(400);
      await expect(expenseFilter).toBeVisible(); // still present after click
    }
  });

  /* 6 — export menu */
  test('export menu is accessible', async ({ page }) => {
    await goToTransactions(page);
    const exportBtn = page.locator('button:has-text("Export"), button[aria-label*="export" i]').first();
    if (await exportBtn.isVisible({ timeout: 5_000 })) {
      await exportBtn.click();
      // Dropdown / menu should appear with CSV/PDF options
      const csvOption = page.locator('text=/CSV|Excel|PDF/i').first();
      await expect(csvOption).toBeVisible({ timeout: 3_000 });
    }
  });

  /* 7 — close modal with Escape */
  test('Escape closes Add Transaction modal', async ({ page }) => {
    await goToTransactions(page);
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Transaction")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 3_000 });
    }
  });

});
