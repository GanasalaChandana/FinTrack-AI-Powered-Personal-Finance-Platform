import type { Page } from '@playwright/test';

/** Merchant name the add-transaction test uses, so its rows can be found and removed. */
export const TEST_MERCHANT = 'Test Coffee Shop';

/**
 * Calls go through the site (/api/* is proxied to the backend) with the page's
 * session cookies; writes need the same header the app sends.
 */
export const API_HEADERS = { 'X-Requested-With': 'fintrack' };

/**
 * Deletes the transactions the smoke tests created in the test account, so they
 * don't pile up run after run. Uses the logged-in page's session.
 */
export async function deleteTestTransactions(page: Page): Promise<number> {
  const headers = API_HEADERS;
  const res = await page.request.get(`/api/transactions?limit=1000`, { headers });
  if (!res.ok()) return 0;
  const rows: { id: number; merchant?: string }[] = await res.json();

  let deleted = 0;
  for (const row of rows.filter((r) => r.merchant === TEST_MERCHANT)) {
    if ((await page.request.delete(`/api/transactions/${row.id}`, { headers })).ok()) deleted++;
  }
  return deleted;
}
