import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    css: false,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      reporter: ['text', 'html', 'json-summary'],
      include: ['lib/**', 'components/**'],
      exclude: ['**/*.test.{ts,tsx}', 'node_modules/**'],
    },
    reporters: process.env.CI ? ['default', ['json', { outputFile: 'test-results.json' }]] : ['default'],
  },
});
