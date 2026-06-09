import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // ---- Unit tests (Node, no DOM required) ----
  {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
    },
  },

  // ---- Browser tests (Playwright / Chromium) ----
  {
    test: {
      name: 'browser',
      browser: {
        enabled: true,
        provider: 'playwright',
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
      include: ['tests/browser/**/*.test.ts'],
      setupFiles: ['tests/browser/setup.ts'],
    },
  },
]);
