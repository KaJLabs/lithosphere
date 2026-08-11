import type { Signer } from 'ethers';

export interface SupportedToken {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  icon?: string | null;
}

export interface DestinationChain {
  name: string;
  chainId: number;
  symbol: string;
  label: string;
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface MultXConfig {
  /** EVM address of the deployed MultX bridge contract (Kamet side). */
  bridgeAddress: string;
  /** Base URL of the bridge backend (without trailing slash, no `/bridge` suffix). */
  bridgeApiUrl: string;
  /** Tokens whitelisted by the bridge. */
  supportedTokens: SupportedToken[];
  /** Destination chains the bridge can target. */
  destinationChains: DestinationChain[];
  /** Optional address of the canonical LITHO/wLITHO token on Kamet (consumed by deployment health checks). */
  lithoTokenAddress?: string;
  /**
   * Override `globalThis.fetch`. Useful in Node environments without a
   * built-in fetch (Node ≥ 18 has it natively).
   */
  fetch?: FetchLike;
  /**
   * Optional override for `chains` mapping (defaults to `{ lithosphere: 900523, ethereum: 1 }`).
   */
  chains?: Record<string, number>;
}

export interface TokenMeta {
  symbol?: string;
  decimals?: number;
}

export interface ApproveTokenOptions {
  signer: Signer;
  tokenAddress: string;
  /** Raw amount in base units (string or BigNumber-compatible). */
  amount: string | bigint | number;
  tokenMeta?: TokenMeta;
}

export interface LockTokensOptions {
  signer: Signer;
  tokenAddress: string;
  amount: string | bigint | number;
  targetChainId: number;
  tokenMeta?: TokenMeta;
}

export interface LockResult {
  txHash: string;
  blockNumber: number;
  transactionIndex: number;
}

export type BridgeStatusValue =
  | 'pending'
  | 'locked'
  | 'signing'
  | 'signed'
  | 'completed'
  | 'failed';

export interface BridgeStatusResponse {
  status: BridgeStatusValue;
  failureReason?: string;
  [key: string]: unknown;
}

export interface BridgeTransaction {
  timestamp?: string;
  fromToken?: string;
  toToken?: string;
  amount?: string | number;
  txHash?: string;
  status?: BridgeStatusValue;
  failureReason?: string;
  explorerUrl?: string;
  [key: string]: unknown;
}

export interface GetStatusOptions {
  /** Maximum poll attempts before throwing a timeout. Default 60. */
  maxAttempts?: number;
  /**
   * Optional callback fired when the API reports a status that maps to
   * WAITING_SIGNATURES (`locked` | `signing` | `signed`). Used by the
   * React adapter to drive UI state.
   */
  onWaitingSignatures?: () => void;
}
