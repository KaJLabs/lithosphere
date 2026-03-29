/**
 * Lithosphere SDK Client
 * Main client for interacting with the Lithosphere blockchain
 */

import { ErrorCode, LithoError, NETWORKS } from './types.js';

import type {
  AccountBalance,
  CallOptions,
  ClientConfig,
  NetworkConfig,
  NetworkName,
  TransactionReceipt,
  TransactionResponse,
} from './types.js';

/**
 * Default client configuration
 */
const DEFAULT_CONFIG: Partial<ClientConfig> = {
  timeout: 30000,
  retry: {
    count: 3,
    delay: 1000,
  },
};

/**
 * LithoClient - Main SDK client for Lithosphere blockchain
 *
 * @example
 * ```typescript
 * // Using network name
 * const client = new LithoClient('mainnet');
 *
 * // Using custom RPC URL
 * const client = new LithoClient('https://custom-rpc.example.com');
 *
 * // Get balance
 * const balance = await client.getBalance('0x...');
 * console.log(balance);
 * ```
 */
export class LithoClient {
  private readonly rpcUrl: string;
  private readonly chainId: number | undefined;
  private readonly timeout: number;
  private readonly retryCount: number;
  private readonly retryDelay: number;

  /**
   * Creates a new LithoClient instance
   *
   * @param rpcUrlOrNetwork - RPC URL or network name ('mainnet', 'staging', 'devnet', 'local')
   * @param config - Optional configuration overrides
   */
  constructor(
    rpcUrlOrNetwork: string | NetworkName,
    config?: Partial<ClientConfig>
  ) {
    // Check if it's a network name
    if (rpcUrlOrNetwork in NETWORKS) {
      const network = NETWORKS[rpcUrlOrNetwork as NetworkName];
      this.rpcUrl = network.rpcUrl;
      this.chainId = network.chainId;
    } else {
      // Assume it's a custom RPC URL
      if (!rpcUrlOrNetwork.startsWith('http')) {
        throw new LithoError(
          ErrorCode.INVALID_PARAMETER,
          `Invalid RPC URL: ${rpcUrlOrNetwork}. Must start with http:// or https://`
        );
      }
      this.rpcUrl = rpcUrlOrNetwork;
      this.chainId = config?.chainId;
    }

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    this.timeout = mergedConfig.timeout ?? 30000;
    this.retryCount = mergedConfig.retry?.count ?? 3;
    this.retryDelay = mergedConfig.retry?.delay ?? 1000;
  }

  /*//////////////////////////////////////////////////////////////
                           PUBLIC METHODS
  //////////////////////////////////////////////////////////////*/

  /**
   * Get the native token balance for an address
   *
   * @param address - The address to query
   * @param options - Optional call options
   * @returns Account balance information
   *
   * @example
   * ```typescript
   * const balance = await client.getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f6E234');
   * console.log(`Balance: ${balance.formatted} ${balance.symbol}`);
   * ```
   */
  async getBalance(
    address: string,
    options?: CallOptions
  ): Promise<AccountBalance> {
    this.validateAddress(address);

    const blockTag = options?.blockTag ?? 'latest';

    try {
      const result = await this.rpcCall<string>('eth_getBalance', [
        address,
        typeof blockTag === 'number' ? `0x${blockTag.toString(16)}` : blockTag,
      ]);

      const balance = BigInt(result);
      const formatted = this.formatUnits(balance, 18);

      return {
        address,
        balance,
        formatted,
        symbol: 'LITHO',
      };
    } catch (error) {
      throw new LithoError(
        ErrorCode.NETWORK_ERROR,
        `Failed to get balance for ${address}`,
        { cause: error }
      );
    }
  }

  /**
   * Get the current block number
   *
   * @returns Current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      const result = await this.rpcCall<string>('eth_blockNumber', []);
      return parseInt(result, 16);
    } catch (error) {
      throw new LithoError(ErrorCode.NETWORK_ERROR, 'Failed to get block number', {
        cause: error,
      });
    }
  }

  /**
   * Get the chain ID
   *
   * @returns Chain ID
   */
  async getChainId(): Promise<number> {
    if (this.chainId) {
      return this.chainId;
    }

    try {
      const result = await this.rpcCall<string>('eth_chainId', []);
      return parseInt(result, 16);
    } catch (error) {
      throw new LithoError(ErrorCode.NETWORK_ERROR, 'Failed to get chain ID', {
        cause: error,
      });
    }
  }

  /**
   * Get transaction by hash
   *
   * @param hash - Transaction hash
   * @returns Transaction details or null if not found
   */
  async getTransaction(hash: string): Promise<TransactionResponse | null> {
    this.validateHash(hash);

    try {
      const result = await this.rpcCall<RawTransaction | null>(
        'eth_getTransactionByHash',
        [hash]
      );

      if (!result) {
        return null;
      }

      return this.parseTransaction(result);
    } catch (error) {
      throw new LithoError(
        ErrorCode.NETWORK_ERROR,
        `Failed to get transaction ${hash}`,
        { cause: error }
      );
    }
  }

  /**
   * Get transaction receipt
   *
   * @param hash - Transaction hash
   * @returns Transaction receipt or null if not found/pending
   */
  async getTransactionReceipt(hash: string): Promise<TransactionReceipt | null> {
    this.validateHash(hash);

    try {
      const result = await this.rpcCall<RawReceipt | null>(
        'eth_getTransactionReceipt',
        [hash]
      );

      if (!result) {
        return null;
      }

      return this.parseReceipt(result);
    } catch (error) {
      throw new LithoError(
        ErrorCode.NETWORK_ERROR,
        `Failed to get transaction receipt ${hash}`,
        { cause: error }
      );
    }
  }

  /**
   * Wait for a transaction to be mined
   *
   * @param hash - Transaction hash
   * @param confirmations - Number of confirmations to wait for (default: 1)
   * @param timeout - Timeout in milliseconds (default: 60000)
   * @returns Transaction receipt
   */
  async waitForTransaction(
    hash: string,
    confirmations = 1,
    timeout = 60000
  ): Promise<TransactionReceipt> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getTransactionReceipt(hash);

      if (receipt) {
        const currentBlock = await this.getBlockNumber();
        const confirmationCount = currentBlock - receipt.blockNumber + 1;

        if (confirmationCount >= confirmations) {
          return receipt;
        }
      }

      // Wait before polling again
      await this.sleep(2000);
    }

    throw new LithoError(
      ErrorCode.TIMEOUT,
      `Transaction ${hash} not confirmed within ${timeout}ms`
    );
  }

  /**
   * Get network configuration
   *
   * @returns Network configuration
   */
  getNetworkConfig(): NetworkConfig | null {
    for (const network of Object.values(NETWORKS)) {
      if (network.rpcUrl === this.rpcUrl) {
        return network;
      }
    }
    return null;
  }

  /*//////////////////////////////////////////////////////////////
                          PRIVATE METHODS
  //////////////////////////////////////////////////////////////*/

  /**
   * Make an RPC call with retry logic
   */
  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const response = await this.fetchWithTimeout(this.rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as JsonRpcResponse<T>;

        if (data.error) {
          throw new Error(`RPC Error: ${data.error.message}`);
        }

        return data.result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryCount) {
          await this.sleep(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error('Unknown RPC error');
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Validate Ethereum address format
   */
  private validateAddress(address: string): void {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new LithoError(
        ErrorCode.INVALID_ADDRESS,
        `Invalid address format: ${address}`
      );
    }
  }

  /**
   * Validate transaction hash format
   */
  private validateHash(hash: string): void {
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      throw new LithoError(
        ErrorCode.INVALID_PARAMETER,
        `Invalid transaction hash format: ${hash}`
      );
    }
  }

  /**
   * Format wei to human-readable string
   */
  private formatUnits(value: bigint, decimals: number): string {
    const divisor = 10n ** BigInt(decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '') || '0';

    if (trimmedFractional === '0') {
      return integerPart.toString();
    }

    return `${integerPart}.${trimmedFractional}`;
  }

  /**
   * Parse raw transaction response
   */
  private parseTransaction(raw: RawTransaction): TransactionResponse {
    return {
      hash: raw.hash,
      blockNumber: raw.blockNumber ? parseInt(raw.blockNumber, 16) : null,
      blockHash: raw.blockHash,
      transactionIndex: raw.transactionIndex
        ? parseInt(raw.transactionIndex, 16)
        : null,
      from: raw.from,
      to: raw.to,
      value: BigInt(raw.value),
      gasUsed: BigInt(raw.gas),
      gasPrice: BigInt(raw.gasPrice),
      status: raw.blockNumber ? 'confirmed' : 'pending',
    };
  }

  /**
   * Parse raw receipt response
   */
  private parseReceipt(raw: RawReceipt): TransactionReceipt {
    return {
      transactionHash: raw.transactionHash,
      blockNumber: parseInt(raw.blockNumber, 16),
      blockHash: raw.blockHash,
      gasUsed: BigInt(raw.gasUsed),
      cumulativeGasUsed: BigInt(raw.cumulativeGasUsed),
      contractAddress: raw.contractAddress,
      status: parseInt(raw.status, 16) as 0 | 1,
      logs: raw.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: parseInt(log.blockNumber, 16),
        transactionHash: log.transactionHash,
        logIndex: parseInt(log.logIndex, 16),
      })),
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/*//////////////////////////////////////////////////////////////
                        INTERNAL TYPES
//////////////////////////////////////////////////////////////*/

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: {
    code: number;
    message: string;
  };
}

interface RawTransaction {
  hash: string;
  blockNumber: string | null;
  blockHash: string | null;
  transactionIndex: string | null;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
}

interface RawReceipt {
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  contractAddress: string | null;
  status: string;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    transactionHash: string;
    logIndex: string;
  }>;
}

export default LithoClient;
