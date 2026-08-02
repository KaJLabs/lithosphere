import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live',
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'https://kamet.litho.ai',
    headless: true,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'live-chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ]
});
