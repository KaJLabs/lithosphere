import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: ['src/index.ts'],

  // Output formats: ESM and CommonJS
  format: ['esm', 'cjs'],

  // Output directory
  outDir: 'dist',

  // Generate TypeScript declaration files
  dts: true,

  // Generate sourcemaps
  sourcemap: true,

  // Clean output directory before build
  clean: true,

  // Split chunks for better tree-shaking
  splitting: true,

  // Minify production builds
  minify: process.env.NODE_ENV === 'production',

  // Tree shaking
  treeshake: true,

  // Target Node.js 18+
  target: 'node18',

  // External dependencies (don't bundle)
  external: ['viem'],

  // Environment variables to replace
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },

  // Additional esbuild options
  esbuildOptions(options) {
    options.charset = 'utf8';
    options.legalComments = 'none';
  },

  // Output file naming
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
});
