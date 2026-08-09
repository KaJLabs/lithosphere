import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const here = path.dirname(fileURLToPath(import.meta.url));
const sdkRoot = path.resolve(here, '../sdk').replaceAll('\\', '/');
const localEthersEntry = path.resolve(here, 'node_modules/ethers/lib.esm/index.js');

// The SDK is a file dependency outside this package. Resolve its ethers v6
// import to this application's copy so Vite's polyfill shims remain reachable.
const sdkEthersDedupe = {
  name: 'multx-sdk-ethers-v6-dedupe',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source !== 'ethers' || !importer) return null;
    const normalized = importer.replaceAll('\\', '/');
    const fromSdk = normalized.startsWith(`${sdkRoot}/`) ||
      /\/(packages\/multx-sdk|@litho\/multx-sdk|vendor\/multx-sdk)\//.test(normalized);
    return fromSdk ? localEthersEntry : null;
  },
};

export default defineConfig({
  plugins: [
    sdkEthersDedupe,
    react(),
    svgr({ svgrOptions: {} }),
    // Web3Modal v5 / WalletConnect transitively require Buffer/process/global
    // at runtime. Webpack/Next inject those automatically; Vite does not.
    nodePolyfills({
      protocolImports: true,
      globals: { Buffer: true, global: true, process: true }
    })
  ],
  // Dev-only proxy: forwards calls to the Cosmos LCD and EVM RPC so the
  // browser avoids CORS. Production Nginx serves equivalent proxy paths.
  server: {
    proxy: {
      '/lcd-proxy': {
        target: 'https://api-3.litho.ai',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/lcd-proxy/, ''),
        secure: true,
      },
      '/rpc-proxy': {
        target: 'https://rpc-3.litho.ai',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/rpc-proxy/, ''),
        secure: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 6000,
    // Valtio + proxy-compare hit a known runtime bug under esbuild minification.
    minify: 'terser',
    terserOptions: {
      compress: {
        keep_fargs: true
      }
    }
  }
});
