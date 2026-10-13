import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke test against the dev servers. Locally it drives the system's Edge
 * (no browser download); CI installs Playwright's Chromium.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 768 },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'msedge' }) },
    },
  ],
  webServer: {
    command: 'node scripts/dev.mjs',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
