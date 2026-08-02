import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const here = path.dirname(fileURLToPath(import.meta.url));
const consolidatedSdkRoot = path.resolve(here, '../sdk');
const consolidatedSdkRootPrefix = `${consolidatedSdkRoot.replaceAll('\\', '/')}/`;

// kamet-explorer carries two ethers copies: `ethers` (v6, used by
// @web3modal/ethers) and `ethers5` (npm alias to ethers v5, used by the
// MultX bridge code). The extracted @litho/multx-sdk imports from `ethers`
// (v5 API). Resolve those imports to this app's `ethers5` copy so the SDK's
// transitive deps (@ethersproject/*, bn.js) are co-located with this app's
// `vite-plugin-node-polyfills` shims — otherwise Rollup walks up from a
// pnpm-store path and cannot reach `vite-plugin-node-polyfills/shims/*`.
const ethers5EntryFromKametExplorer = path.resolve(
  here,
  'node_modules/ethers5/lib.esm/index.js'
);
const sdkEthersDedupe = {
  name: 'multx-sdk-ethers-dedupe',
  enforce: 'pre',
  async resolveId(source, importer) {
    if (source !== 'ethers') return null;
    if (!importer) return null;
    // Match the SDK by source (packages/), by package name (@litho/), AND by the
    // vendored copy (vendor/multx-sdk) — kamet-explorer installs it via
    // `file:vendor/multx-sdk`, and node_modules/@litho/multx-sdk is a SYMLINK to
    // that path, so Rollup resolves SDK imports to `.../vendor/multx-sdk/...`.
    // Without the vendor/ arm the SDK's `import 'ethers'` fell through to ethers
    // v6 (no BigNumber/utils) and threw at runtime.
    const fromConsolidatedSdk = importer.replaceAll('\\', '/').startsWith(consolidatedSdkRootPrefix);
    const fromHistoricalSdk = /[/\\](packages[/\\]multx-sdk|@litho[/\\]multx-sdk|vendor[/\\]multx-sdk)[/\\]/.test(importer);
    const fromSdk = fromConsolidatedSdk || fromHistoricalSdk;
    if (!fromSdk) return null;
    return ethers5EntryFromKametExplorer;
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
  // browser avoids CORS (api-3.litho.ai / rpc-3.litho.ai don't set
  // Access-Control-Allow-Origin). In production the kamet.litho.ai nginx
  // serves the same paths.
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
    // Valtio + proxy-compare hit a known "an is not iterable" runtime bug when
    // minified by esbuild's default settings. Terser handles the symbol-based
    // iteration paths correctly.
    minify: 'terser',
    terserOptions: {
      compress: {
        // Keep destructuring/spread untouched so iterables stay iterables.
        keep_fargs: true
      }
    }
  }
});
