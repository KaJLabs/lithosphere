# Changelog

All notable changes to `@lithosphere/blockchain-core` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## 0.1.0 — 2026-05-11

Initial release. Replaces the previous stubs-only package with real primitives.

### Added
- `NETWORKS` registry: `mainnet`, `staging`, `devnet`, `local` profiles with
  chainId 700777, `rpc.litho.ai`, bech32 prefix `litho`, `ulitho` denom.
- `getNetwork(name)` and `isNetworkName(value)` helpers.
- `LithoError` class and `ErrorCode` enum covering RPC, network, and validation
  failure modes.
- Typed ABI exports: `LEP100_ABI`, `WLITHO_ABI`, `LITHONATIVE_ABI` (extracted
  from `Makalu/contracts/artifacts`). Each is `as const` for `abitype` /
  `viem` inference.
- Shared TypeScript types: `NetworkConfig`, `TransactionResponse`,
  `TransactionReceipt`, `AccountBalance`, `TokenBalance`, `Log`, `CallOptions`,
  `SendOptions`, `ClientConfig`, `RetryConfig`.
- Dual ESM + CJS build via `tsup`; type definitions for both.

### Removed
- Stub subdirectories (`chain/`, `consensus/`, `crypto/`, `contracts/`, `sdk/`)
  that targeted unimplemented research features (MDKM, ring signatures,
  threshold signatures, Linear Comm BFT). These remain documented as planned
  roadmap items in `docs/` but are out of scope for this package.

### Migration
- No prior published version exists (`private: true` in 0.0.x). No breaking
  changes for consumers.
