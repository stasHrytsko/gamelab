import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: 'http://localhost:4175',
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4175 --strictPort',
    url: 'http://localhost:4175',
    reuseExistingServer: true,
  },
});
