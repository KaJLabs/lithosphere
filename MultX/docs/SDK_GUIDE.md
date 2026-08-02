# MultX Bridge SDK — Integration Guide

`@litho/multx-sdk` **v0.2.0** — TypeScript SDK for the Lithosphere **MultX cross-chain bridge**.
Framework-agnostic core (`MultXClient`) + optional React adapter (`useMultX`).
Ships drop-in presets for **Makalu** and **Kamet** — no address wrangling.

> All contract addresses below were verified on-chain (2026-06). The bridge is
> **live and hands-off**: lock → validators sign → an automated relayer releases
> on the destination chain.

---

## 1. Install

You'll receive a tarball: `litho-multx-sdk-0.2.0.tgz`.

```bash
npm install ./litho-multx-sdk-0.2.0.tgz
npm install ethers@^5.7.0        # required peer dependency
# react@^18 is only needed if you import @litho/multx-sdk/react
```

> ⚠️ **ethers v5.** The SDK uses ethers v5 (`BigNumber`, `providers.Web3Provider`).
> If your app is on ethers v6, scope a v5 instance to the bridge calls.

---

## 2. Quick start

```ts
import { MultXClient } from '@litho/multx-sdk';
import { MAKALU_TESTNET, KAMET_MAINNET } from '@litho/multx-sdk/presets';
import { ethers } from 'ethers';

// One client per SOURCE chain. Pick the preset for the chain you're bridging FROM.
const client = new MultXClient(MAKALU_TESTNET); // or KAMET_MAINNET

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const token = MAKALU_TESTNET.supportedTokens.find((t) => t.symbol === 'wLITHO')!;
const amount = ethers.utils.parseUnits('100', token.decimals);

// 1) approve  2) lock toward the destination chain
await client.approveToken({ signer, tokenAddress: token.address, amount, tokenMeta: token });
const { txHash } = await client.lockTokens({
  signer,
  tokenAddress: token.address,
  amount,
  targetChainId: 900523,           // a chainId from client.destinationChains
  tokenMeta: token,
});

// 3) poll until the destination chain releases (hands-off — relayer submits it)
const final = await client.getStatus(txHash, {
  onWaitingSignatures: () => console.log('validators signing…'),
});
if (final.status === 'completed') console.log('bridged ✓');
```

### Presets

| Preset | Source chain | Bridge | Tokens | Destinations (today) |
|---|---|---|---|---|
| `MAKALU_TESTNET` | Makalu **700777** | `0x5832D5E609c6690f74c7683606Eb20F89ff096a6` | 10 (no QTT) | Kamet (900523) |
| `KAMET_MAINNET` | Kamet **900523** | `0x3a896BDF3a1088287FA84aB5a43bB30e2535F263` | 11 | Sepolia (11155111), Base Sepolia (84532), BNB testnet (97) |

Each preset exposes `supportedTokens`, `destinationChains`, `bridgeAddress`, `bridgeApiUrl`.

---

## 3. The network (chainId) rule — read this

Bridging is **per source chain**. Construct **one client per chain** and route by
the user's connected network:

- Bridging **from Makalu** → use `MAKALU_TESTNET`, wallet must be on **Makalu (700777 / `0xAB169`)**.
- Bridging **from Kamet** → use `KAMET_MAINNET`, wallet must be on **Kamet (900523 / `0xDBDAB`)**.

**Prompt a network switch before `approveToken` / `lockTokens`.** The same token
symbol is a *different contract address* on each chain — using the wrong chain's
client yields "token not supported" or reads the wrong balance.

---

## 4. React adapter (optional)

```tsx
import { useMultX, MULTX_STEPS } from '@litho/multx-sdk/react';

const { loading, error, step, txHash, approveToken, lockTokens, getBridgeStatus }
  = useMultX({ client, signer });

// step ∈ IDLE → APPROVING → LOCKING → WAITING_SIGNATURES → COMPLETED | ERROR
```

---

## 5. Error handling

Write operations throw a `MultXError` with a user-facing `.message` and the raw
RPC error in `.cause`:

```ts
import { MultXError } from '@litho/multx-sdk';
try {
  await client.lockTokens({ /* … */ });
} catch (err) {
  if (err instanceof MultXError) showToast(err.message); // decoded, user-safe
}
```
Decoded cases: wallet rejection, insufficient balance/allowance, `execution
reverted: <reason>`, insufficient native gas, and Cosmos-SDK/Ethermint nonce
mismatch (auto-retried once).

---

## 6. What's live today

- ✅ **Makalu ↔ Kamet** — both directions, hands-off (automated release relayer).
  - Makalu→Kamet is funded for **testnet-scale amounts** right now (top-up planned).
- ⛔ **Kamet/Makalu → Sepolia / Base / BNB** — wrapped-token destinations are **not
  wired yet** (Route 2, on the roadmap). `KAMET_MAINNET.destinationChains` lists
  them, but transfers there won't complete until those tokens are deployed.
  Stick to Makalu↔Kamet for now.

---

## 7. Bridge backend API (reference)

`MultXClient` calls these for you; documented for direct/server use. Base URL:
`https://bridge.litho.ai`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{"status":"ok","db":"ok"}` |
| GET | `/chains` | supported chains + bridge addresses |
| GET | `/tokens` | supported tokens |
| GET | `/bridge/status/:txHash` | `pending\|locked\|signing\|signed\|completed\|failed` |
| GET | `/bridge/signatures/:txHash` | collected validator signatures |
| GET | `/bridge/transactions/:address` | per-address history |

> There is **no `/quote`, `/route`, or `/execute`** — those are swap-aggregator
> concerns, not the bridge. If a swap call 4xx/5xxs, it's hitting a path this
> service doesn't implement, not a bridge outage.

---

## 8. Verify your setup

```ts
import { MultXClient } from '@litho/multx-sdk';
import { MAKALU_TESTNET } from '@litho/multx-sdk/presets';
const c = new MultXClient(MAKALU_TESTNET);
console.log(c.isContractDeployed(), c.supportedTokens.length); // true 10
const sigs = await c.getSignatures('0x…');     // no signer needed (read)
const hist = await c.getHistory('0xYourAddr'); // [] if none; never throws
```

---

## 9. Support

- Issues / new destination chains / token additions → Lithosphere infra team.
- Updates ship as a new tarball (version bump) — re-install the new `.tgz`.

Package: `@litho/multx-sdk` · License: UNLICENSED (internal Lithosphere component).
