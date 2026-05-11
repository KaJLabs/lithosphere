/**
 * Shared types used by the @lithosphere/sdk client and any consumer that
 * wants to render or persist chain data without depending on the client.
 */

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

export interface TransactionResponse {
  hash: string;
  /** null until the tx is included in a block */
  blockNumber: number | null;
  blockHash: string | null;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  value: bigint;
  gasUsed: bigint;
  gasPrice: bigint;
  status: TransactionStatus;
  timestamp?: number;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed: bigint;
  cumulativeGasUsed: bigint;
  contractAddress: string | null;
  /** 1 = success, 0 = revert */
  status: 0 | 1;
  logs: Log[];
}

export interface AccountBalance {
  address: string;
  /** raw balance in the smallest unit (wei / ulitho) */
  balance: bigint;
  /** human-readable string with decimal point */
  formatted: string;
  symbol: string;
}

export interface TokenBalance {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  formatted: string;
}

export interface RetryConfig {
  /** Max number of retry attempts after the initial call (so total = retries + 1). */
  count: number;
  /** Base delay between retries in ms; subsequent retries use exponential backoff. */
  delay: number;
}

export interface ClientConfig {
  /** Optional chain ID override. Only needed for custom RPCs without a registered NetworkConfig. */
  chainId?: number;
  /** Per-request timeout in ms. Default 30_000. */
  timeout?: number;
  /** Retry policy for transient failures (network errors / 5xx). */
  retry?: RetryConfig;
}

export interface CallOptions {
  blockTag?: 'latest' | 'pending' | 'earliest' | number;
}

export interface SendOptions {
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  value?: bigint;
}
