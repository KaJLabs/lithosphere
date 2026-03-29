# @lithosphere/sdk

Official TypeScript SDK for the Lithosphere L1 blockchain.

## Installation

```bash
npm install @lithosphere/sdk
# or
pnpm add @lithosphere/sdk
```

## Quick Start

```typescript
import { createClient } from '@lithosphere/sdk';

const client = await createClient('mainnet');

const balance = await client.getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f6E234');
console.log(`${balance.formatted} ${balance.symbol}`);

const blockNumber = await client.getBlockNumber();
```

## API

### `LithoClient`

```typescript
import { LithoClient } from '@lithosphere/sdk';

// From network name
const client = new LithoClient('mainnet');

// From custom RPC URL
const client = new LithoClient('https://custom-rpc.example.com', {
  timeout: 30000,
  retry: { count: 3, delay: 1000 },
});
```

| Method | Returns | Description |
|--------|---------|-------------|
| `getBalance(address)` | `AccountBalance` | Native LITHO balance |
| `getBlockNumber()` | `number` | Current block height |
| `getChainId()` | `number` | Chain ID |
| `getTransaction(hash)` | `TransactionResponse \| null` | Transaction by hash |
| `getTransactionReceipt(hash)` | `TransactionReceipt \| null` | Receipt by hash |
| `waitForTransaction(hash, confirmations?, timeout?)` | `TransactionReceipt` | Wait for confirmations |
| `getNetworkConfig()` | `NetworkConfig \| null` | Current network info |

### `createClient(rpcUrlOrNetwork, config?)`

Factory function that returns a `Promise<LithoClient>`.

### `NETWORKS`

Predefined network configurations:

| Network | Chain ID | RPC |
|---------|----------|-----|
| `mainnet` | 999 | `https://mainnet.lithosphere.network/rpc` |
| `staging` | 1001 | `https://staging.lithosphere.network/rpc` |
| `devnet` | 1000 | `https://devnet.lithosphere.network/rpc` |
| `local` | 31337 | `http://localhost:8545` |

## Development

```bash
pnpm install
pnpm dev          # Watch mode
pnpm test         # Run tests
pnpm build        # Build with tsup (ESM + CJS)
pnpm typecheck    # Type check
pnpm size         # Check bundle size
```

## Publishing

```bash
pnpm prepublishOnly   # Builds automatically
npm publish
```

The package ships dual ESM/CJS builds via `tsup`. The `publishConfig` ensures public access on npm.
