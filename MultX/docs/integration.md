# MultX Bridge Integration Guide

How to integrate cross-chain bridging from your app or contract using the Lithosphere MultX bridge.

**Status:** v0 — Kamet (source) ↔ Ethereum Sepolia / BNB Testnet (destinations). Mainnet rollout tracked under M4 in the roadmap.
**SDK:** `@litho/multx-sdk` (workspace package — `MultX/sdk/`)
**Backend:** `bridge-api` (Express + Postgres + ethers v5)

---

## Architecture (one-paragraph)

A user `lockTokens` on the Kamet `MultXBridge` contract → bridge-api's event listener catches the `TokensLocked` event and writes a row to Postgres → validators (currently a mock signer service) sign the cross-chain attestation → user collects N-of-M signatures from `/bridge/signatures/:txHash` → submits them to the destination-chain `MultXBridge.releaseTokens()` to mint the wrapped token.

Reverse direction (dest chain → Kamet) is symmetric: burn wrapped → validators attest → release on Kamet.

---

## Live addresses

### Kamet (source)

| Contract | Address |
|---|---|
| `MultXBridge` | `0x3a896BDF3a1088287FA84aB5a43bB30e2535F263` |

### Bridge API

| Endpoint | Purpose |
|---|---|
| `https://api-3.litho.ai/bridge/status/:txHash` | Tx status + signature count |
| `https://api-3.litho.ai/bridge/signatures/:txHash` | Collected validator signatures |
| `https://api-3.litho.ai/bridge/transactions/:address` | Paginated bridge history (cursor-based, max 100 per page) |
| `https://api-3.litho.ai/docs` | Swagger UI (OpenAPI 3.0 spec) |
| `https://api-3.litho.ai/metrics` | Prometheus metrics |

---

## Quick Start (React + ethers v5)

Install:

```bash
# Workspace consumer (this repo):
"@litho/multx-sdk": "file:../sdk"
```

(npm-published version forthcoming — tracked under M1.4 v0.1.0 follow-up.)

### Construct the client once

Mirror the singleton pattern from `kamet-explorer/src/config/multxClient.js`:

```js
import { MultXClient } from '@litho/multx-sdk';
import { KAMET_KNOWN_TOKENS } from './kametRegistry';

export const multxClient = new MultXClient({
  bridgeAddress:    '0x3a896BDF3a1088287FA84aB5a43bB30e2535F263',
  bridgeApiUrl:     'https://api-3.litho.ai',
  supportedTokens:  KAMET_KNOWN_TOKENS.filter((t) => t.type === 'LEP100'),
  destinationChains: [
    { chainId: 11155111, name: 'Ethereum Sepolia',  symbol: 'ETH', label: 'Testnet' },
    { chainId: 97,       name: 'BNB Testnet',       symbol: 'BNB', label: 'Testnet' },
  ],
  chains: { lithosphere: 900523, ethereum: 1 },
});
```

### Use the React hook (drop-in replacement for the legacy `useMultX`)

```jsx
import { useMultX, MULTX_STEPS } from '@litho/multx-sdk/react';
import { multxClient } from './multxClient';
import { useWallet } from './useWallet';

const SwapButton = () => {
  const wallet = useWallet();
  const { step, txHash, error, approveToken, lockTokens } = useMultX({
    client: multxClient,
    signer: wallet.signer,
  });

  // Walk through the state machine:
  // IDLE → APPROVING → APPROVED → LOCKING → LOCKED → WAITING_SIGNATURES → COMPLETED
};
```

### Or use the framework-agnostic core

```js
import { MultXClient } from '@litho/multx-sdk';

const client = new MultXClient({ /* config above */ });

// 1. Approve
await client.approveToken({ signer, tokenAddress, amount });

// 2. Lock
const lockResult = await client.lockTokens({
  signer, tokenAddress, amount, targetChainId: 11155111,
});

// 3. Wait for validator signatures
const status = await client.getStatus(lockResult.txHash, { maxAttempts: 60 });
const signatures = await client.getSignatures(lockResult.txHash);

// 4. (On dest chain) submit signatures to MultXBridge.releaseTokens(...)
```

---

## State machine

```
IDLE
  │
  ├── approveToken(...) ──► APPROVING ──► APPROVED
  │                                         │
  │                                         ├── lockTokens(...) ──► LOCKING ──► LOCKED
  │                                                                                │
  │                                                                                └─► WAITING_SIGNATURES (poll bridge-api)
  │                                                                                                          │
  │                                                                                                          └─► COMPLETED
  │
  └── (any step) ──► ERROR ─── decodeBridgeError() returns user-friendly message
```

---

## Error decoding

The SDK exports `decodeBridgeError(err, { symbol })` which:

- Recognises ERC20 revert selectors `0xe450d38c` (insufficient balance) and `0xfb8f41b2` (insufficient allowance).
- Recognises Ethermint sequence-error patterns (`/invalid nonce/i`, `/account sequence mismatch/i`) and surfaces a "reset MetaMask account" hint.
- Returns a `MultXError` with a `.code` and `.message` ready for UI display.

```js
import { decodeBridgeError } from '@litho/multx-sdk';

try {
  await client.lockTokens({ ... });
} catch (err) {
  const decoded = decodeBridgeError(err, { symbol: 'COLLE' });
  setUiError(decoded.message);   // "Insufficient COLLE balance" etc.
}
```

---

## Polling / status

`client.getStatus(txHash, opts)` polls `bridge-api/bridge/status/:txHash` with exponential backoff (5s → 30s, 60 attempts max). It terminates early on:

- `status === 'completed'` → resolves with the final status object (includes `releaseTxHash` if available).
- HTTP 4xx → throws (no point retrying).
- 60 attempts exhausted → throws timeout.

---

## Bridge contract ABI (subset)

Useful for direct contract reads:

```solidity
function lockTokens(address token, uint256 amount, uint256 targetChain) external returns (uint256 nonce);
function releaseTokens(address token, address user, uint256 amount, uint256 sourceChain, uint256 sourceNonce, bytes32 sourceTxHash, bytes[] calldata signatures) external;
function isTokenSupported(address token) external view returns (bool);

event TokensLocked(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 indexed targetChain, uint256 nonce);
event TokensReleased(bytes32 indexed txHash, address indexed token, address indexed user, uint256 amount, uint256 indexed sourceChain, address submitter);
```

Full ABI: `kamet-explorer/src/data/kametRegistry.js` `MULTX_BRIDGE_ABI`.

---

## Rate limits

`bridge-api` enforces 100 req/min/IP by default (configurable via `RATE_LIMIT_*` env vars). Build your polling loop with backoff to stay under this — the SDK's `getStatus()` already does.

---

## Gotchas

- **Always check `client.isContractDeployed()`** before showing the bridge UI to users. The bridge-api's `/health` endpoint and the `MULTX_CONFIG.bridgeAddress` config can be empty during maintenance windows.
- **Sequence errors on Ethermint:** if a user has out-of-sync MetaMask nonces, the SDK retries once with a fresh `pending` nonce. If that fails, surface the reset-account instructions.
- **Token approval is per-spender:** users must approve the bridge contract address (`0x3a896BDF...`) — not the bridge-api URL or anything else.
- **Wrapped tokens on dest chains** are not deployed yet (M4 work). v0 bridge attestations are signed but cannot yet be redeemed on Sepolia/BNB until M4.3 ships.

---

## See also

- SDK source + tests: [`MultX/sdk/`](../sdk/)
- Bridge contract source: [`contracts/contracts/MultXBridge.sol`](../../contracts/contracts/MultXBridge.sol)
- Bridge API source: [`MultX/api/`](../api/)
- OpenAPI spec: [`MultX/api/openapi.json`](../api/openapi.json) or live at `https://api-3.litho.ai/docs`
- M4 roadmap (mainnet bridge production rollout): [`docs/workstreams/kamet-mainnet-prep/ROADMAP.md`](../workstreams/kamet-mainnet-prep/ROADMAP.md)

---

## Last reviewed

2026-05-08 — bridge-api v1 hardening (rate-limit, OpenAPI, Prometheus) shipped under M1.5; SDK extracted under M1.4.
