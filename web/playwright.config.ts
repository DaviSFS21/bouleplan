import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  // Tests share one database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Lets a machine with a preinstalled Chromium skip `playwright install`.
        launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH },
      },
    },
  ],
});
