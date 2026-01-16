import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry point
  entry: ['src/index.ts'],

  // Output format - CJS for CLI compatibility
  format: ['cjs'],

  // Output directory
  outDir: 'dist',

  // Generate TypeScript declarations
  dts: false,

  // Generate sourcemaps for debugging
  sourcemap: false,

  // Clean output directory before build
  clean: true,

  // Target Node.js 18+
  target: 'node18',

  // Add shebang for CLI execution
  banner: {
    js: '#!/usr/bin/env node',
  },

  // Don't minify for better debugging
  minify: false,

  // Tree shake unused code
  treeshake: true,

  // Platform
  platform: 'node',

  // Splitting disabled for single executable
  splitting: false,

  // Don't bundle - use node_modules at runtime
  bundle: true,
  
  // External - don't bundle these
  external: [],
});
