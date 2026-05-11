# Changelog

## 0.1.0 — 2026-05-11

Initial release.

### Added
- `LithoClient` with constructor taking either a `NetworkName` or a custom RPC URL.
- Read methods: `getChainId`, `getBlockNumber`, `getBalance`, `getTransaction`,
  `getTransactionReceipt`, `waitForTransaction`.
- Retry with exponential backoff on transient failures (network errors, 5xx, 429).
- Typed errors via `LithoError` + `ErrorCode` (re-exported from
  `@lithosphere/blockchain-core`).
- Re-exports of network registry, ABIs (LEP100, WLITHO, LITHONative), and shared
  types so a single install is enough for most consumers.
- Dual ESM + CJS build via `tsup`; bundled `.d.ts` for both.

### Dependencies
- Runtime: `@lithosphere/blockchain-core` (workspace).
- Built on `fetch` — no viem / ethers / web3 dependency.
