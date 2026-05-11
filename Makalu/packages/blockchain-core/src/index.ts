/**
 * @lithosphere/blockchain-core
 *
 * Low-level primitives for the Lithosphere stack: network registry, typed ABIs,
 * shared types, and the canonical `LithoError` class. Zero runtime dependencies.
 *
 * For the high-level client (`LithoClient`, retry/backoff, balance helpers),
 * install `@lithosphere/sdk` which depends on this package.
 */

export {
  NETWORKS,
  getNetwork,
  isNetworkName,
  type NetworkConfig,
  type NetworkName,
} from './networks.js';

export { ErrorCode, LithoError } from './errors.js';

export type {
  AccountBalance,
  CallOptions,
  ClientConfig,
  Log,
  RetryConfig,
  SendOptions,
  TokenBalance,
  TransactionReceipt,
  TransactionResponse,
  TransactionStatus,
} from './types.js';

export { LEP100_ABI, LITHONATIVE_ABI, WLITHO_ABI } from './abis/index.js';

export const VERSION = '0.1.0';
