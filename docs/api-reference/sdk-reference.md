# SDK Reference

The Lithosphere TypeScript SDK ships as two layered packages:

- **`@lithosphere/blockchain-core`** — low-level primitives: network registry,
  typed ABIs (LEP-100, WLITHO, LITHONative), `LithoError` + `ErrorCode`, and
  shared types. Zero runtime dependencies — safe to include in browser bundles.
- **`@lithosphere/sdk`** — high-level `LithoClient` with retry/backoff, balance
  helpers, and transaction polling. Depends on `blockchain-core` for ABIs and
  types; built on raw `fetch` so it works in Node 18+ and modern browsers
  without a transitive viem/ethers/web3 dep.

For contract **writes** and signing, pair the SDK with viem or ethers — the
ABIs exported here plug directly into both.

## Install

```bash
pnpm add @lithosphere/sdk
# pulls @lithosphere/blockchain-core transitively
```

## Quickstart — read the head block in 30 seconds

```ts
import { LithoClient } from '@lithosphere/sdk';

const client = new LithoClient('mainnet');
const height = await client.getBlockNumber();
console.log(`Lithosphere head block: ${height}`);
```

Run it: save as `head.ts`, `pnpm tsx head.ts`. Should print the current
block height against `https://rpc.litho.ai` in under one second.

## Quickstart — balance lookup with proper error handling

```ts
import { LithoClient, LithoError, ErrorCode } from '@lithosphere/sdk';

const client = new LithoClient('mainnet');

try {
  const { formatted, symbol } = await client.getBalance(
    '0x22d279d24f0b7ca5d49c5a7a7f032da416f72387',
  );
  console.log(`${formatted} ${symbol}`);
} catch (err) {
  if (err instanceof LithoError) {
    switch (err.code) {
      case ErrorCode.INVALID_ADDRESS:
        console.error('Bad address format');
        break;
      case ErrorCode.RPC_TIMEOUT:
        console.error('RPC took too long — retry or switch endpoints');
        break;
      case ErrorCode.RATE_LIMITED:
        console.error('Rate limit hit — back off');
        break;
      default:
        console.error('Unexpected:', err.message);
    }
  }
}
```

## Quickstart — LEP-100 token balance via viem

```ts
import { LEP100_ABI, NETWORKS } from '@lithosphere/sdk';
import { createPublicClient, http } from 'viem';

const viemClient = createPublicClient({
  transport: http(NETWORKS.mainnet.rpcUrl),
});

const balance = await viemClient.readContract({
  address: '0xtoken-contract-here...',
  abi: LEP100_ABI,
  functionName: 'balanceOf',
  args: ['0xholder-address-here...'],
});

console.log(`Balance: ${balance}`);
```

---

## `LithoClient`

### Constructor

```ts
new LithoClient(rpcUrlOrNetwork: string | NetworkName, config?: ClientConfig)
```

`rpcUrlOrNetwork` is either a registered network name (`'mainnet'`, `'staging'`,
`'devnet'`, `'local'`) or a fully-qualified http(s) RPC URL.

`config` (optional):

```ts
interface ClientConfig {
  chainId?: number;                      // only needed for custom RPCs
  timeout?: number;                      // per-request ms (default 30_000)
  retry?: { count: number; delay: number };  // default {3, 250}
}
```

Retry uses exponential backoff: `delay * 2^attempt`. Only retries on transient
failures (`NETWORK_ERROR`, `RPC_TIMEOUT`, `RATE_LIMITED`). JSON-RPC errors
(invalid params, contract reverts) fail immediately — retrying won't help.

### Methods

| Method | Signature | Notes |
|--------|-----------|-------|
| `getChainId()` | `Promise<number>` | Returns the configured chainId without calling RPC when known. |
| `getBlockNumber()` | `Promise<number>` | Current head block as decimal. |
| `getBalance(addr, opts?)` | `Promise<AccountBalance>` | Native LITHO balance with `formatted` (decimal string) and `balance` (bigint wei). |
| `getTransaction(hash)` | `Promise<TransactionResponse \| null>` | Returns `null` for unknown hash. |
| `getTransactionReceipt(hash)` | `Promise<TransactionReceipt \| null>` | Returns `null` while pending. |
| `waitForTransaction(hash, confirmations?, timeoutMs?, pollIntervalMs?)` | `Promise<TransactionReceipt>` | Throws `LithoError(TIMEOUT)` if not confirmed within the budget. |
| `getNetworkConfig()` | `NetworkConfig \| null` | The registered NetworkConfig that matches this client's RPC URL. |

All return types are exported from `@lithosphere/sdk` (re-exported from
`@lithosphere/blockchain-core`).

---

## `NETWORKS` registry

```ts
import { NETWORKS } from '@lithosphere/sdk';

console.log(NETWORKS.mainnet);
// {
//   name: 'mainnet',
//   isPublic: true,
//   rpcUrl: 'https://rpc.litho.ai',
//   lcdUrl: 'https://api.litho.ai',
//   cosmosRpcUrl: 'https://rpc.litho.ai',
//   explorerUrl: 'https://makalu.litho.ai',
//   chainId: 700777,
//   cosmosChainId: 'lithosphere_700777-2',
//   bech32Prefix: 'litho',
//   currency: { name: 'Lithosphere', symbol: 'LITHO', decimals: 18, denom: 'ulitho' },
// }
```

The `mainnet`, `staging`, and `devnet` profiles currently all point at the live
Makalu testnet (there is no separate mainnet chain yet — see
[chain-parameters.md](../network/chain-parameters.md)). The `local` profile
targets `http://localhost:8545`.

---

## Errors

Every failure path throws `LithoError` with a typed `code`. `instanceof
LithoError` and `switch (err.code)` are the supported patterns.

```ts
enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_NOT_FOUND = 'NETWORK_NOT_FOUND',
  INVALID_CHAIN_ID = 'INVALID_CHAIN_ID',
  RPC_TIMEOUT = 'RPC_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
}
```

Underlying causes are preserved on `err.cause` (standard ES2022 `Error.cause`).

---

## Typed ABIs

Three exports cover the contracts that ship with Lithosphere:

```ts
import { LEP100_ABI, WLITHO_ABI, LITHONATIVE_ABI } from '@lithosphere/sdk';
```

These are JSON ABIs extracted at build time from `Makalu/contracts/artifacts/`.
For tight viem / abitype inference, re-assert as `const` at the call site:

```ts
const abi = LEP100_ABI as const;
```

For most callers the default typing is sufficient — `viem.readContract` and
`ethers.Contract` both accept the wider `Abi` type.

---

## Project scaffolding

`create-litho-app` remains the fastest path from zero to a working project:

```bash
npx create-litho-app my-dapp
```

The CLI scaffolds an SDK-consuming starter that imports `@lithosphere/sdk`
out of the box. The `sdk` template in this monorepo
(`Makalu/templates/sdk-template/`, package name
`@lithosphere/sdk-template`) is the source-of-truth for that scaffold and
is intentionally **not** published to npm — it's copied into the new
project on `create-litho-app` invocation.

---

## Examples

- [Hardhat example](../developers/examples/hardhat-example.md) — call contracts via Hardhat scripts
- [Foundry example](../developers/examples/foundry-example.md) — solc + foundry test runner
- [ethers.js example](../developers/examples/ethers-example.md) — read + sign transactions in Node
- [wagmi example](../developers/examples/wagmi-example.md) — full Next.js + wagmi setup

---

## Versioning

This SDK follows semver:

- **Patch** — bug fixes only, no API changes.
- **Minor** — additive (new methods / networks / types).
- **Major** — breaking changes (reserved for v1.0.0+).

See the [release process](../governance/release-process.md) for the publish
workflow and `CHANGELOG.md` in each package directory for the history.
