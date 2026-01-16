/**
 * Lithosphere SDK Type Definitions
 * Shared TypeScript interfaces for the SDK
 */

/*//////////////////////////////////////////////////////////////
                          NETWORK TYPES
//////////////////////////////////////////////////////////////*/

/**
 * Supported network names
 */
export type NetworkName = 'mainnet' | 'staging' | 'devnet' | 'local';

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Network name identifier */
  name: NetworkName;
  /** Chain ID */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer URL */
  explorerUrl?: string;
  /** Native currency symbol */
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Predefined network configurations
 */
export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    chainId: 999,
    rpcUrl: 'https://mainnet.lithosphere.network/rpc',
    explorerUrl: 'https://explorer.lithosphere.network',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
    },
  },
  staging: {
    name: 'staging',
    chainId: 1001,
    rpcUrl: 'https://staging.lithosphere.network/rpc',
    explorerUrl: 'https://staging-explorer.lithosphere.network',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
    },
  },
  devnet: {
    name: 'devnet',
    chainId: 1000,
    rpcUrl: 'https://devnet.lithosphere.network/rpc',
    explorerUrl: 'https://devnet-explorer.lithosphere.network',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
    },
  },
  local: {
    name: 'local',
    chainId: 31337,
    rpcUrl: 'http://localhost:8545',
    currency: {
      name: 'Lithosphere',
      symbol: 'LITHO',
      decimals: 18,
    },
  },
};

/*//////////////////////////////////////////////////////////////
                        TRANSACTION TYPES
//////////////////////////////////////////////////////////////*/

/**
 * Transaction status
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

/**
 * Transaction response from the blockchain
 */
export interface TransactionResponse {
  /** Transaction hash */
  hash: string;
  /** Block number (null if pending) */
  blockNumber: number | null;
  /** Block hash (null if pending) */
  blockHash: string | null;
  /** Transaction index in the block */
  transactionIndex: number | null;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string | null;
  /** Value transferred (in wei) */
  value: bigint;
  /** Gas used */
  gasUsed: bigint;
  /** Gas price */
  gasPrice: bigint;
  /** Transaction status */
  status: TransactionStatus;
  /** Timestamp */
  timestamp?: number;
}

/**
 * Transaction receipt
 */
export interface TransactionReceipt {
  /** Transaction hash */
  transactionHash: string;
  /** Block number */
  blockNumber: number;
  /** Block hash */
  blockHash: string;
  /** Gas used */
  gasUsed: bigint;
  /** Cumulative gas used */
  cumulativeGasUsed: bigint;
  /** Contract address (if contract creation) */
  contractAddress: string | null;
  /** Transaction status (1 = success, 0 = failure) */
  status: 0 | 1;
  /** Logs emitted */
  logs: Log[];
}

/**
 * Log entry from transaction
 */
export interface Log {
  /** Address of the contract that emitted the log */
  address: string;
  /** Topics (indexed parameters) */
  topics: string[];
  /** Data (non-indexed parameters) */
  data: string;
  /** Block number */
  blockNumber: number;
  /** Transaction hash */
  transactionHash: string;
  /** Log index */
  logIndex: number;
}

/*//////////////////////////////////////////////////////////////
                         ACCOUNT TYPES
//////////////////////////////////////////////////////////////*/

/**
 * Account balance information
 */
export interface AccountBalance {
  /** Account address */
  address: string;
  /** Balance in wei */
  balance: bigint;
  /** Balance formatted with decimals */
  formatted: string;
  /** Symbol */
  symbol: string;
}

/**
 * Token balance
 */
export interface TokenBalance {
  /** Token contract address */
  tokenAddress: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Balance in smallest unit */
  balance: bigint;
  /** Balance formatted */
  formatted: string;
}

/*//////////////////////////////////////////////////////////////
                          CLIENT TYPES
//////////////////////////////////////////////////////////////*/

/**
 * Client configuration options
 */
export interface ClientConfig {
  /** RPC URL or network name */
  rpcUrl: string;
  /** Optional chain ID (will be fetched if not provided) */
  chainId?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Retry options */
  retry?: {
    /** Number of retries */
    count: number;
    /** Delay between retries in ms */
    delay: number;
  };
}

/**
 * Call options for read operations
 */
export interface CallOptions {
  /** Block number or tag */
  blockTag?: 'latest' | 'pending' | 'earliest' | number;
}

/**
 * Send options for write operations
 */
export interface SendOptions {
  /** Gas limit */
  gasLimit?: bigint;
  /** Gas price (legacy) */
  gasPrice?: bigint;
  /** Max fee per gas (EIP-1559) */
  maxFeePerGas?: bigint;
  /** Max priority fee per gas (EIP-1559) */
  maxPriorityFeePerGas?: bigint;
  /** Nonce override */
  nonce?: number;
  /** Value to send */
  value?: bigint;
}

/*//////////////////////////////////////////////////////////////
                          ERROR TYPES
//////////////////////////////////////////////////////////////*/

/**
 * SDK error codes
 */
export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
}

/**
 * SDK Error class
 */
export class LithoError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = 'LithoError';
  }
}
