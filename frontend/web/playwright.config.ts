import { defineConfig, devices } from '@playwright/test';

/**
 * FinTrack E2E test configuration
 * Docs: https://playwright.dev/docs/test-configuration
 *
 * Run with:
 *   npx playwright test              — headless
 *   npx playwright test --ui         — interactive UI
 *   npx playwright test --headed     — visible browser
 */

export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit workers on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    /* Base URL — Next.js dev server */
    baseURL: process.env.BASE_URL ?? 'http://localhost:3003',
    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',
    /* Capture video on first retry */
    video: 'on-first-retry',
    /* Capture trace on first retry */
    trace: 'on-first-retry',
    /* Viewport */
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    /* ── Setup: create auth state ── */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    /* ── Chromium (main) ── */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ── Firefox ── */
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    /* ── Mobile Chrome ── */
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* Start the Next.js dev server automatically */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
