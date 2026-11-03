import type { Page } from '@playwright/test';

/** Merchant name the add-transaction test uses, so its rows can be found and removed. */
export const TEST_MERCHANT = 'Test Coffee Shop';

const API_URL = (process.env.API_URL || 'http://localhost:8080').trim().replace(/\/$/, '');

/**
 * Deletes the transactions the smoke tests created in the test account, so they
 * don't pile up run after run. Uses the logged-in page's token.
 */
export async function deleteTestTransactions(page: Page): Promise<number> {
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  if (!token) return 0;
  const headers = { Authorization: `Bearer ${token}` };

  const res = await page.request.get(`${API_URL}/api/transactions?limit=1000`, { headers });
  if (!res.ok()) return 0;
  const rows: { id: number; merchant?: string }[] = await res.json();

  let deleted = 0;
  for (const row of rows.filter((r) => r.merchant === TEST_MERCHANT)) {
    if ((await page.request.delete(`${API_URL}/api/transactions/${row.id}`, { headers })).ok()) deleted++;
  }
  return deleted;
}
