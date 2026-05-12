# `@lithosphere/sdk` examples

Self-contained scripts that exercise each public surface. They're not unit
tests — they hit the **live** Makalu testnet, so a quick run also serves as
a smoke check that the chain is healthy.

| Script | What it exercises |
|--------|-------------------|
| `01-balances.ts` | `LithoClient` against the EVM JSON-RPC: chain head + native balance |
| `02-rest-blocks.ts` | `createLithoRestClient` against the indexer REST API: paginated `/blocks` + per-height detail with end-to-end type safety |
| `03-contracts-viem.ts` | Pair `LEP100_ABI` (from `@lithosphere/blockchain-core`) with `viem` for a typed read of an ERC-1155 token balance |

## Run from the monorepo

```bash
cd Makalu/packages/sdk
pnpm exec tsx examples/01-balances.ts
pnpm exec tsx examples/02-rest-blocks.ts
# 03 needs viem; install it first:
pnpm add -D viem
pnpm exec tsx examples/03-contracts-viem.ts
```

## Run from a standalone npm install (consumer flow)

```bash
mkdir litho-sdk-demo && cd litho-sdk-demo
pnpm init
pnpm add @lithosphere/sdk
pnpm add -D tsx typescript @types/node
# Copy one of the examples in, then:
pnpm exec tsx 02-rest-blocks.ts
```
