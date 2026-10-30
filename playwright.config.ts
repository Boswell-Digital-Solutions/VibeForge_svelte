import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for VibeForge
 *
 * Tests the workbench architecture refactoring:
 * - New Project Wizard modal
 * - Quick Create dialog
 * - Keyboard shortcuts
 * - User preferences
 */

export default defineConfig({
  testDir: './tests/e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use saved auth state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Use saved auth state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // Use saved auth state
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Real authentication against a configured NeuroForge endpoint. Its own
    // testDir keeps it out of the default run, and it deliberately takes no
    // synthetic storage state and does not depend on the hermetic setup. It
    // skips unless E2E_REAL_AUTH_* is configured; the release gate sets
    // E2E_REAL_AUTH_REQUIRED=true, which makes a missing setting a failure.
    // Run it with: pnpm test:e2e:real-auth
    {
      name: 'real-auth',
      testDir: './tests/e2e-real-auth',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
