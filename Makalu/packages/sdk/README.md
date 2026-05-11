# @lithosphere/sdk

High-level TypeScript client for the Lithosphere chain.

```bash
pnpm add @lithosphere/sdk
# or
npm install @lithosphere/sdk
```

## Quickstart

```ts
import { LithoClient, NETWORKS, LithoError, ErrorCode } from '@lithosphere/sdk';

const client = new LithoClient('mainnet');

const height = await client.getBlockNumber();
const { formatted } = await client.getBalance('0x22d279d24f0b7ca5d49c5a7a7f032da416f72387');
console.log(`Head block: ${height}, balance: ${formatted} LITHO`);
```

## Error handling

Every failure path throws a `LithoError` with a typed `code`:

```ts
try {
  await client.getBalance('0xnot-a-real-address');
} catch (err) {
  if (err instanceof LithoError && err.code === ErrorCode.INVALID_ADDRESS) {
    // user input is bad — surface a friendly message
  }
}
```

## Retry / backoff

The client retries on transient failures (network errors, 5xx, 429) with
exponential backoff. Defaults: 3 retries, base delay 250ms, exponentially
doubled per attempt. Tune via the constructor:

```ts
const client = new LithoClient('mainnet', {
  timeout: 10_000,
  retry: { count: 5, delay: 500 },
});
```

## Contract calls

Pair with viem (or ethers) and the ABIs from `@lithosphere/blockchain-core`:

```ts
import { LEP100_ABI } from '@lithosphere/sdk';
import { createPublicClient, http } from 'viem';

const viemClient = createPublicClient({ transport: http('https://rpc.litho.ai') });
const balance = await viemClient.readContract({
  address: '0xtoken-contract...',
  abi: LEP100_ABI,
  functionName: 'balanceOf',
  args: ['0xholder...'],
});
```

## Network registry

```ts
import { NETWORKS } from '@lithosphere/sdk';
console.log(NETWORKS.mainnet.chainId);   // 700777
console.log(NETWORKS.mainnet.explorerUrl); // https://makalu.litho.ai
```

See [docs/api-reference/sdk-reference.md](https://github.com/KaJLabs/Lithosphere/blob/main/docs/api-reference/sdk-reference.md) for the full API.
