/**
 * Pairs `LEP100_ABI` from @lithosphere/blockchain-core with viem for a typed
 * read of an ERC-1155 token balance on Makalu.
 *
 *   pnpm add -D viem
 *   pnpm exec tsx examples/03-contracts-viem.ts
 *
 * The SDK intentionally doesn't ship its own contract-write client — you
 * pick viem or ethers and plug in the ABIs. This file is the canonical
 * "how do I do contract reads" answer.
 */
import { LEP100_ABI, NETWORKS } from '@lithosphere/sdk';
import { createPublicClient, http, type Address } from 'viem';

// Replace with a real LEP100 token + holder on Makalu before running.
// Pull a live address from `https://makalu.litho.ai/tokens` or the indexer
// REST API `/tokens` endpoint.
const TOKEN: Address = '0x0000000000000000000000000000000000000000';
const HOLDER: Address = '0x0000000000000000000000000000000000000000';
const TOKEN_ID = 0n;

async function main() {
  const viemClient = createPublicClient({
    transport: http(NETWORKS.mainnet.rpcUrl),
  });

  const balance = await viemClient.readContract({
    address: TOKEN,
    abi: LEP100_ABI,
    functionName: 'balanceOf',
    args: [HOLDER, TOKEN_ID],
  });

  console.log(`[balance] token=${TOKEN} holder=${HOLDER} id=${TOKEN_ID}: ${balance}`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
