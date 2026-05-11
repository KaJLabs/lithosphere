# wagmi + Next.js example

Goal: connect a wallet, show the connected user's LITHO balance, and call a
LEP-100 `transfer` from a Next.js 14 app — using the Lithosphere SDK's network
registry and ABIs.

## Install

```bash
pnpm add @lithosphere/sdk wagmi viem @tanstack/react-query
```

`@lithosphere/sdk` re-exports the `NETWORKS` registry and `LEP100_ABI` you
need; no other Lithosphere packages required.

## Configure wagmi

Set up a single `wagmi.ts` module so every page reuses the same config.

```ts
// app/wagmi.ts
'use client';

import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { NETWORKS } from '@lithosphere/sdk';

const net = NETWORKS.mainnet;

export const lithosphere = defineChain({
  id: net.chainId,
  name: 'Lithosphere',
  nativeCurrency: {
    name: net.currency.name,
    symbol: net.currency.symbol,
    decimals: net.currency.decimals,
  },
  rpcUrls: {
    default: { http: [net.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Makalu Explorer', url: net.explorerUrl ?? '' },
  },
});

export const config = createConfig({
  chains: [lithosphere],
  connectors: [injected()],
  transports: {
    [lithosphere.id]: http(),
  },
});
```

## Wrap the app

```tsx
// app/providers.tsx
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './wagmi';
import { ReactNode } from 'react';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Balance + Transfer page

```tsx
// app/page.tsx
'use client';

import { useAccount, useBalance, useConnect, useDisconnect, useWriteContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseUnits } from 'viem';
import { LEP100_ABI } from '@lithosphere/sdk';

const TOKEN_ADDR = '0xreplace-with-your-token-contract...' as const;

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: bal } = useBalance({ address });
  const { writeContract, isPending } = useWriteContract();

  if (!isConnected) {
    return (
      <button onClick={() => connect({ connector: injected() })}>
        Connect wallet
      </button>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <p>
        Connected as <code>{address}</code>{' '}
        <button onClick={() => disconnect()}>Disconnect</button>
      </p>
      <p>
        Balance: {bal?.formatted ?? '…'} {bal?.symbol}
      </p>
      <button
        disabled={isPending}
        onClick={() =>
          writeContract({
            address: TOKEN_ADDR,
            abi: LEP100_ABI,
            functionName: 'transfer',
            args: ['0xrecipient...', parseUnits('1', 18)],
          })
        }
      >
        {isPending ? 'Sending…' : 'Send 1 token'}
      </button>
    </main>
  );
}
```

## Run it

```bash
pnpm dev
```

Open http://localhost:3000, click **Connect wallet**, switch your wallet to
Lithosphere (chain ID 700777, RPC `https://rpc.litho.ai`), then click **Send**.

## Notes

- `NETWORKS.mainnet` is the live testnet today — there is no separate mainnet
  chain yet. See [chain-parameters.md](../../network/chain-parameters.md).
- For typed inference on `writeContract`, the `as const` re-assertion shown
  above is not strictly required — wagmi/viem accept `LEP100_ABI` as-is —
  but adding it gives narrower types in your IDE.
- If you need a server-side read client (e.g. in a Next.js Route Handler),
  use `new LithoClient('mainnet')` from `@lithosphere/sdk` directly. See the
  [ethers example](./ethers-example.md) for the Node-side pattern.
