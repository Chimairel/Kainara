import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ['website-content.spec.ts', 'website-content-ssr.spec.ts', 'landing-presenter.spec.ts'],
  use: { ...base.use, baseURL: 'http://127.0.0.1:3100' },
  webServer: [
    {
      command: 'node e2e/website-content-server-fixture.mjs',
      url: 'http://127.0.0.1:3101/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run start -- --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 120000,
      env: { INTERNAL_API_URL: 'http://127.0.0.1:3101', NUTRIMIND_REPAIR_E2E: 'false' },
    },
  ],
});
