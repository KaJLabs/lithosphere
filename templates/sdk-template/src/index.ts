/**
 * @lithosphere/sdk
 * Official TypeScript SDK for the Lithosphere L1 blockchain
 *
 * @packageDocumentation
 */

// Main client
export { LithoClient, default as LithoClientDefault } from './client.js';

// Types
export type {
  // Network types
  NetworkName,
  NetworkConfig,
  // Transaction types
  TransactionStatus,
  TransactionResponse,
  TransactionReceipt,
  Log,
  // Account types
  AccountBalance,
  TokenBalance,
  // Client types
  ClientConfig,
  CallOptions,
  SendOptions,
} from './types.js';

// Constants and enums
export { NETWORKS, ErrorCode, LithoError } from './types.js';

// ABIs
// Note: JSON imports require bundler support or fs.readFileSync at runtime
// export { default as ERC20_ABI } from './abis/ERC20.json' with { type: 'json' };
import ERC20_ABI_DATA from './abis/ERC20.json' with { type: 'json' };
export const ERC20_ABI = ERC20_ABI_DATA;

// Version
export const VERSION = '0.1.0';

/**
 * Create a new LithoClient instance
 * Convenience factory function
 *
 * @param rpcUrlOrNetwork - RPC URL or network name
 * @returns LithoClient instance
 *
 * @example
 * ```typescript
 * import { createClient } from '@lithosphere/sdk';
 *
 * const client = createClient('mainnet');
 * const balance = await client.getBalance('0x...');
 * ```
 */
export async function createClient(
  rpcUrlOrNetwork: string,
  config?: Partial<import('./types.js').ClientConfig>
): Promise<import('./client.js').LithoClient> {
  const { LithoClient } = await import('./client.js');
  return new LithoClient(rpcUrlOrNetwork, config);
}
