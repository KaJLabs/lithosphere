# @litho/multx-sdk

TypeScript SDK for the **MultX cross-chain bridge** on Lithosphere Kamet.
Framework-agnostic core (`MultXClient`) with an optional React adapter
(`useMultX`).

This package wraps:

- The Kamet-side bridge contract (approve, lock, status reads)
- The bridge backend API (signature aggregation, transfer status, history)
- Polling logic with sensible backoff
- Error decoding for ERC20 reverts and Cosmos-SDK / Ethermint nonce issues

It was extracted from `kamet-explorer/src/hooks/useMultX.js` so other apps
(Thanos Wallet, future dashboards, server-side relayers) can reuse the same
logic without copying code.

## Install

The SDK is published as a workspace package (not yet on public npm).

```bash
pnpm add @litho/multx-sdk      # inside the monorepo workspace
# or for non-workspace consumers:
npm install file:../MultX/sdk
```

Peer dependencies (you must install these in your app):

- `ethers@^5.7.0` (the SDK uses ethers v5 — see [ADR 0003](../../docs/workstreams/kamet-mainnet-prep/decisions/) for why)
- `react@^18.0.0` (only required if you import `@litho/multx-sdk/react`)

## Quick start — Kamet preset (recommended)

Use the bundled, on-chain-verified Kamet config. No address assembly:

```ts
import { MultXClient } from '@litho/multx-sdk';
import { KAMET_MAINNET } from '@litho/multx-sdk/presets';

const client = new MultXClient(KAMET_MAINNET);
// → bridge 0x3a896BDF…F263, 11 supported tokens, dest chains
//   (Sepolia / Base Sepolia / BNB testnet) all pre-wired.
```

> **chainId caveat.** The bridge lives on **Kamet (900523)**. If your app
> (e.g. Thanos Wallet) defaults to **Makalu (700777)**, the user's wallet must
> be on Kamet before `approveToken` / `lockTokens` — those tokens are different
> contracts on Makalu. Prompt a network switch to `0xDBDAB` (900523) first.

## Quick start — Makalu preset

Makalu (testnet, chainId 700777) has its own bridge + 10 tokens (no QTT):

```ts
import { MultXClient } from '@litho/multx-sdk';
import { MAKALU_TESTNET } from '@litho/multx-sdk/presets';

const client = new MultXClient(MAKALU_TESTNET);
// → bridge 0x5832D5E6…096a6, 10 supported tokens.
//   destinationChains = Kamet (Route 1, live); Sepolia + Base added with Route 2.
```

Each preset is keyed to one source chain — construct one client per chain and
route by the user's connected network.

## Usage — framework-agnostic (custom config)

```ts
import { MultXClient } from '@litho/multx-sdk';
import { ethers } from 'ethers';

const client = new MultXClient({
  bridgeAddress: '0x...',
  bridgeApiUrl: 'https://bridge.litho.ai',
  supportedTokens: [
    { symbol: 'COLLE', name: 'Colle AI', decimals: 18, address: '0x...', icon: null },
  ],
  destinationChains: [
    { name: 'Ethereum Mainnet', chainId: 1, symbol: 'ETH', label: 'Mainnet' },
  ],
});

// Reads (no signer needed)
const isReady = client.isContractDeployed();
const sigs = await client.getSignatures(txHash);
const history = await client.getHistory(userAddress);

// Writes (require a signer)
const provider = new ethers.providers.Web3Provider((window as any).ethereum);
const signer = provider.getSigner();

await client.approveToken({
  signer,
  tokenAddress: '0x...',
  amount: ethers.utils.parseUnits('100', 18),
  tokenMeta: { symbol: 'COLLE', decimals: 18 },
});

const lock = await client.lockTokens({
  signer,
  tokenAddress: '0x...',
  amount: ethers.utils.parseUnits('100', 18),
  targetChainId: 1, // Ethereum Mainnet
  tokenMeta: { symbol: 'COLLE', decimals: 18 },
});

console.log('locked:', lock.txHash);

// Poll until validators sign and the destination chain releases
const final = await client.getStatus(lock.txHash, {
  maxAttempts: 60,
  onWaitingSignatures: () => console.log('signatures pending'),
});

if (final.status === 'completed') {
  console.log('bridge complete');
}
```

## Usage — React

```tsx
import { useMultX, MULTX_STEPS } from '@litho/multx-sdk/react';
import { useMemo } from 'react';
import { MultXClient } from '@litho/multx-sdk';

const client = new MultXClient({ /* config */ });

function BridgeButton({ signer, tokenAddress, amount, targetChainId }) {
  const {
    loading,
    error,
    step,
    txHash,
    approveToken,
    lockTokens,
    getBridgeStatus,
  } = useMultX({ client, signer });

  const onClick = async () => {
    await approveToken(tokenAddress, amount);
    const result = await lockTokens(tokenAddress, amount, targetChainId);
    await getBridgeStatus(result.txHash);
  };

  return (
    <button onClick={onClick} disabled={loading}>
      {step === MULTX_STEPS.APPROVING && 'Approving... (1/2)'}
      {step === MULTX_STEPS.LOCKING && 'Locking... (2/2)'}
      {step === MULTX_STEPS.WAITING_SIGNATURES && 'Waiting for signatures...'}
      {step === MULTX_STEPS.COMPLETED && 'Done'}
      {step === MULTX_STEPS.IDLE && 'Bridge'}
    </button>
  );
}
```

## State machine

```
IDLE → APPROVING → APPROVED → LOCKING → LOCKED → WAITING_SIGNATURES → COMPLETED
                          ↓
                        ERROR (from any step)
```

Use `client.getStatus(txHash)` to poll. The `onWaitingSignatures` callback
fires once when the backend reports `locked` / `signing` / `signed`.

## Error handling

Operations that can revert throw a `MultXError` with a human-readable message:

```ts
import { MultXError } from '@litho/multx-sdk';

try {
  await client.lockTokens({ /* ... */ });
} catch (err) {
  if (err instanceof MultXError) {
    console.error('decoded:', err.message); // user-facing
    console.error('raw:', err.cause);       // original RPC error
  }
}
```

Decoded scenarios include:

- Wallet rejection (`ACTION_REJECTED` / code `4001`)
- ERC20 insufficient balance (`0xe450d38c`) — shows have vs need
- ERC20 insufficient allowance (`0xfb8f41b2`) — suggests re-approve
- `execution reverted: <reason>` — extracts the reason string
- Insufficient native gas
- Cosmos-SDK / Ethermint nonce mismatch — provides MetaMask reset instructions
- ethers `UNPREDICTABLE_GAS_LIMIT`

## Pure helpers

```ts
import {
  formatTokenAmount,
  parseTokenAmount,
  normalizeAddress,
  isContractDeployed,
  normalizeBridgeApiBaseUrl,
  isBridgeTxHash,
  shortenBridgeTxHash,
  splitBridgeHistoryTimestamp,
} from '@litho/multx-sdk';
```

All tree-shakeable, framework-free.

## Testing

```bash
pnpm --filter @litho/multx-sdk test
pnpm --filter @litho/multx-sdk typecheck
pnpm --filter @litho/multx-sdk build
```

## Versioning

`v0.2.0` — adds the `MAKALU_TESTNET` preset (bridge
`0x5832D5E6…096a6` on 700777, 10 tokens, verified on-chain 2026-06-17; Route 1
destination = Kamet, Sepolia/Base follow with Route 2).

`v0.1.0` — adds the on-chain-verified `@litho/multx-sdk/presets` (`KAMET_MAINNET`)
and corrects `bridgeAbi` to match the deployed hardened MultXBridge: the
support check now reads the real `supportedTokens(address)` getter (was a
nonexistent `isTokenSupported`, silently swallowed), the dead `getTokenBalance`
fragment is dropped, `lockTokens` returns `bytes32`, and the `targetChain` /
`sourceChain` event fields are no longer (incorrectly) marked `indexed`. The
`MultXClient` happy path is unchanged; only the dead pre-flight check and log
decoding are corrected.

`v0.0.1` — initial extraction from kamet-explorer. Behaviour-preserving.

Future additions:

- `estimateFees(...)` for upfront cost previews
- Standalone event emitter API (`onLocked`, `onCompleted`)
- ethers v6 migration (see ADR)
- Public npm publication

## License

UNLICENSED. Internal Lithosphere infrastructure component.
