/**
 * @lithosphere/sdk
 *
 * High-level client for the Lithosphere chain. Pair with `viem` / `ethers` for
 * contract writes; the ABIs you need ship from `@lithosphere/blockchain-core`.
 */

export { LithoClient } from './client.js';

// Re-export the most-used primitives so consumers can do a single install:
//   import { LithoClient, NETWORKS, LEP100_ABI, LithoError } from '@lithosphere/sdk';
export {
  ErrorCode,
  LithoError,
  NETWORKS,
  LEP100_ABI,
  LITHONATIVE_ABI,
  WLITHO_ABI,
  getNetwork,
  isNetworkName,
  type AccountBalance,
  type CallOptions,
  type ClientConfig,
  type Log,
  type NetworkConfig,
  type NetworkName,
  type RetryConfig,
  type SendOptions,
  type TokenBalance,
  type TransactionReceipt,
  type TransactionResponse,
  type TransactionStatus,
} from '@lithosphere/blockchain-core';

export const SDK_VERSION = '0.1.0';
