/**
 * Hits the live Makalu EVM JSON-RPC via LithoClient.
 *
 *   pnpm exec tsx examples/01-balances.ts
 *
 * Prints the chain head and the native LITHO balance of a sample address
 * (the genesis-funded multisig). Demonstrates the retry/backoff path —
 * try toggling Wi-Fi mid-run; the client recovers without throwing.
 */
import { LithoClient, NETWORKS, LithoError } from '@lithosphere/sdk';

const SAMPLE_ADDRESS = '0x22d279d24f0b7ca5d49c5a7a7f032da416f72387';

async function main() {
  const client = new LithoClient('mainnet', { retry: { count: 3, delay: 250 } });

  const height = await client.getBlockNumber();
  console.log(`[head] block ${height}`);
  console.log(`[head] RPC: ${client.rpcUrl}`);

  const balance = await client.getBalance(SAMPLE_ADDRESS);
  console.log(`[balance] ${SAMPLE_ADDRESS}: ${balance.formatted} ${NETWORKS.mainnet.nativeSymbol ?? 'LITHO'}`);
}

main().catch((err) => {
  if (err instanceof LithoError) {
    console.error(`[error] LithoError ${err.code}: ${err.message}`);
  } else {
    console.error('[error]', err);
  }
  process.exit(1);
});
