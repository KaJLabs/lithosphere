import { defineConfig } from 'vitest/config';

// Integration tests share a single Postgres database (per
// docker-compose.test.yml). When INTEGRATION_TESTS=1 we serialize file
// execution so concurrent TRUNCATE/INSERT cycles in two test files don't
// race against each other. Unit tests stay parallel for speed.
const INTEGRATION = process.env.INTEGRATION_TESTS === '1';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only `.test.ts` files. The broader `src/__tests__/**/*.ts` pattern is
    // redundant (every test file already ends in `.test.ts`) and would pick
    // up shared helpers like `__tests__/integration/fixtures/load.ts` as
    // empty test files, failing with "No test suite found".
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: INTEGRATION ? 30000 : 10000,
    fileParallelism: !INTEGRATION,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/index.ts'],
      reportsDirectory: './coverage',
    },
    reporters: process.env.CI ? ['default', ['json', { outputFile: 'test-results.json' }]] : ['default'],
  },
});
