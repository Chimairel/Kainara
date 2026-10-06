import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Server-rendered media uses a dedicated synthetic backend in its own config.
  testIgnore: ['website-content-ssr.spec.ts'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer:
    process.env.NUTRIMIND_REPAIR_E2E === 'true'
      ? undefined
      : {
          command: 'npm run dev',
          // The intercepted GIS layout fixture must render without local OAuth secrets.
          env: { NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'synthetic-browser-client.apps.googleusercontent.com' },
          url: 'http://127.0.0.1:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
});
