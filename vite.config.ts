import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      // ---- Unit tests (pure Node, no DOM) ----
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
            provider: playwright({ launch: { headless: true } }),
            instances: [{ browser: 'chromium' }],
          },
          include: ['tests/browser/**/*.test.ts'],
          setupFiles: ['tests/browser/setup.ts'],
        },
      },
    ],
  },
});
