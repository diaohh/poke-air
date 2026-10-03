import { defineConfig } from '@playwright/test';

/**
 * E2E: one Host + phone contexts play real battles against the dev servers
 * (docs/10-development.md § Testing). Uses the system Edge (or `E2E_CHANNEL=chrome`), so no
 * browser download is needed. Reuses `pnpm dev` if it is already running.
 * `E2E_BASE_URL=https://<app>` runs the same specs against a deployed frontend instead (no local
 * servers; docs/16-first-deploy.md).
 */
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  timeout: 420_000,
  expect: { timeout: remote ? 90_000 : 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: remote ?? 'http://localhost:5173',
    channel: process.env.E2E_CHANNEL ?? 'msedge',
    // A click on something that never becomes actionable fails instead of hanging the battle loop.
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
  },
  ...(remote
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
