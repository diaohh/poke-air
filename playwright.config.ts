import { defineConfig } from '@playwright/test';

/**
 * E2E: one Host + two phone contexts play a real battle against the dev servers
 * (docs/10-development.md § Testing). Uses the system Edge (or `E2E_CHANNEL=chrome`), so no
 * browser download is needed. Reuses `pnpm dev` if it is already running.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.E2E_CHANNEL ?? 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
