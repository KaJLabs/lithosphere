# ethers.js example (Node)

Goal: read native + LEP-100 balances, sign and send a token transfer from a
Node script using `ethers` v6 alongside the Lithosphere SDK's network registry
and ABIs.

## Install

```bash
pnpm add @lithosphere/sdk ethers
```

## Read native balance via `LithoClient`

`LithoClient` ships with `getBalance` baked in — for read-only flows you
don't need ethers at all.

```ts
// read-balance.ts
import { LithoClient, LithoError, ErrorCode } from '@lithosphere/sdk';

const client = new LithoClient('mainnet');

try {
  const { formatted, symbol } = await client.getBalance(
    '0x22d279d24f0b7ca5d49c5a7a7f032da416f72387',
  );
  console.log(`${formatted} ${symbol}`);
} catch (err) {
  if (err instanceof LithoError && err.code === ErrorCode.RPC_TIMEOUT) {
    console.error('RPC slow — retrying or switching endpoint advised');
  } else {
    throw err;
  }
}
```

Run:

```bash
pnpm tsx read-balance.ts
```

## Read a LEP-100 token balance via ethers

```ts
// read-token-balance.ts
import { ethers } from 'ethers';
import { LEP100_ABI, NETWORKS } from '@lithosphere/sdk';

const provider = new ethers.JsonRpcProvider(NETWORKS.mainnet.rpcUrl);

const TOKEN = '0xreplace-with-your-token-contract...';
const HOLDER = '0xreplace-with-holder-address...';

const token = new ethers.Contract(TOKEN, LEP100_ABI, provider);
const [bal, decimals, symbol]: [bigint, number, string] = await Promise.all([
  token.balanceOf(HOLDER),
  token.decimals(),
  token.symbol(),
]);

console.log(`${ethers.formatUnits(bal, decimals)} ${symbol}`);
```

## Sign and send a native transfer

```ts
// send-native.ts
import { ethers } from 'ethers';
import { NETWORKS } from '@lithosphere/sdk';

const provider = new ethers.JsonRpcProvider(NETWORKS.mainnet.rpcUrl);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const tx = await wallet.sendTransaction({
  to: '0xrecipient...',
  value: ethers.parseEther('1.0'),
});
console.log(`tx: ${tx.hash}`);

const receipt = await tx.wait();
console.log(`mined in block ${receipt?.blockNumber}`);
```

> Never hard-code a private key. Use `process.env.PRIVATE_KEY` and source it
> from a secret manager. For multi-sig / hardware-wallet flows, use the
> appropriate ethers signer (`HardwareWalletSigner`, gnosis Safe SDK, etc.).

## Wait for confirmations with `LithoClient`

The SDK's `waitForTransaction` exits as soon as N confirmations are seen,
with a configurable poll interval — useful for batch jobs that want stronger
guarantees than ethers' default `tx.wait(1)`:

```ts
import { LithoClient } from '@lithosphere/sdk';

const client = new LithoClient('mainnet');
const receipt = await client.waitForTransaction(
  tx.hash,
  /* confirmations */ 3,
  /* timeoutMs    */ 30_000,
  /* pollMs       */ 2_000,
);
console.log(`Final block: ${receipt.blockNumber}, status: ${receipt.status}`);
```

## Notes

- Chain ID 700777 is the same for `NETWORKS.mainnet`, `staging`, and `devnet`
  today — they all route at the live testnet. Choose the profile based on the
  **intent** of your code path (production vs. CI staging job vs. local hardhat
  fork), even though they currently resolve to the same endpoints.
- `LEP100_ABI` and `WLITHO_ABI` ship typed; pass them to ethers `Contract`
  directly — no codegen step needed.
