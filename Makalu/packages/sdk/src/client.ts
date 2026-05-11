/**
 * LithoClient — high-level read client for the Lithosphere EVM JSON-RPC.
 *
 * Built on raw `fetch`, no viem/ethers dependency. Provides:
 *  - Network selection by name (mainnet / staging / devnet / local) or custom RPC URL
 *  - Retry with exponential backoff on transient failures (network errors, 5xx)
 *  - Typed errors via `LithoError` + `ErrorCode` (from @lithosphere/blockchain-core)
 *  - Balance / block / transaction / receipt helpers with bigint values
 *
 * For contract calls and writes, pair this client with `viem` / `ethers` directly —
 * the typed ABIs exported from `@lithosphere/blockchain-core` plug into either.
 */

import {
  ErrorCode,
  LithoError,
  NETWORKS,
  isNetworkName,
  type AccountBalance,
  type CallOptions,
  type ClientConfig,
  type NetworkConfig,
  type NetworkName,
  type TransactionReceipt,
  type TransactionResponse,
} from '@lithosphere/blockchain-core';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

export class LithoClient {
  readonly rpcUrl: string;
  private readonly _chainId: number | undefined;
  private readonly timeout: number;
  private readonly retryCount: number;
  private readonly retryDelay: number;

  /**
   * Create a new client.
   *
   * @param rpcUrlOrNetwork - Either a registered NetworkName (e.g. `'mainnet'`) or
   *                          a fully-qualified RPC URL (`'http(s)://...'`).
   * @param config - Optional overrides for timeout / retry / chainId.
   *
   * @example
   * ```ts
   * import { LithoClient } from '@lithosphere/sdk';
   * const client = new LithoClient('mainnet');
   * const height = await client.getBlockNumber();
   * ```
   */
  constructor(rpcUrlOrNetwork: string | NetworkName, config?: ClientConfig) {
    if (isNetworkName(rpcUrlOrNetwork)) {
      const network = NETWORKS[rpcUrlOrNetwork];
      this.rpcUrl = network.rpcUrl;
      this._chainId = network.chainId;
    } else {
      if (!rpcUrlOrNetwork.startsWith('http://') && !rpcUrlOrNetwork.startsWith('https://')) {
        throw new LithoError(
          ErrorCode.INVALID_PARAMETER,
          `Invalid RPC URL: ${rpcUrlOrNetwork}. Must start with http:// or https://`,
        );
      }
      this.rpcUrl = rpcUrlOrNetwork;
      this._chainId = config?.chainId;
    }

    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT_MS;
    this.retryCount = config?.retry?.count ?? DEFAULT_RETRY_COUNT;
    this.retryDelay = config?.retry?.delay ?? DEFAULT_RETRY_DELAY_MS;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public read methods
  // ─────────────────────────────────────────────────────────────────────────

  /** Resolve the EVM chain ID, either from the constructor or by querying the RPC. */
  async getChainId(): Promise<number> {
    if (this._chainId !== undefined) return this._chainId;
    const hex = await this.rpcCall<string>('eth_chainId', []);
    return parseInt(hex, 16);
  }

  /** Current head block number (decimal). */
  async getBlockNumber(): Promise<number> {
    const hex = await this.rpcCall<string>('eth_blockNumber', []);
    return parseInt(hex, 16);
  }

  /** Native LITHO balance for an address. */
  async getBalance(address: string, options?: CallOptions): Promise<AccountBalance> {
    validateAddress(address);
    const blockTag = options?.blockTag ?? 'latest';
    const tag = typeof blockTag === 'number' ? `0x${blockTag.toString(16)}` : blockTag;
    const hex = await this.rpcCall<string>('eth_getBalance', [address, tag]);
    const raw = BigInt(hex);
    return {
      address,
      balance: raw,
      formatted: formatUnits(raw, 18),
      symbol: 'LITHO',
    };
  }

  /** Look up a transaction by hash. Returns `null` if not found. */
  async getTransaction(hash: string): Promise<TransactionResponse | null> {
    validateHash(hash);
    const raw = await this.rpcCall<RawTransaction | null>('eth_getTransactionByHash', [hash]);
    return raw ? parseTransaction(raw) : null;
  }

  /** Look up a transaction receipt. Returns `null` for pending / unknown. */
  async getTransactionReceipt(hash: string): Promise<TransactionReceipt | null> {
    validateHash(hash);
    const raw = await this.rpcCall<RawReceipt | null>('eth_getTransactionReceipt', [hash]);
    return raw ? parseReceipt(raw) : null;
  }

  /**
   * Poll for the receipt until `confirmations` blocks have built on top of it,
   * or until `timeout` ms elapses (default 60s). Throws `LithoError(TIMEOUT)`.
   */
  async waitForTransaction(
    hash: string,
    confirmations = 1,
    timeoutMs = 60_000,
    pollIntervalMs = 2_000,
  ): Promise<TransactionReceipt> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const receipt = await this.getTransactionReceipt(hash);
      if (receipt) {
        const head = await this.getBlockNumber();
        if (head - receipt.blockNumber + 1 >= confirmations) {
          return receipt;
        }
      }
      await sleep(pollIntervalMs);
    }
    throw new LithoError(
      ErrorCode.TIMEOUT,
      `Transaction ${hash} not confirmed within ${timeoutMs}ms`,
    );
  }

  /** Look up the NetworkConfig that matches this client's RPC URL, if any. */
  getNetworkConfig(): NetworkConfig | null {
    for (const net of Object.values(NETWORKS)) {
      if (net.rpcUrl === this.rpcUrl) return net;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RPC transport with retry + typed errors
  // ─────────────────────────────────────────────────────────────────────────

  /** @internal */
  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const response = await this.fetchWithTimeout({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: attempt + 1, method, params }),
        });

        if (response.status === 429) {
          throw new LithoError(ErrorCode.RATE_LIMITED, `Rate limited (HTTP 429) on ${method}`);
        }
        if (response.status >= 500 && response.status < 600) {
          throw new LithoError(
            ErrorCode.NETWORK_ERROR,
            `Upstream ${response.status} on ${method}`,
          );
        }
        if (!response.ok) {
          throw new LithoError(
            ErrorCode.NETWORK_ERROR,
            `HTTP ${response.status} ${response.statusText} on ${method}`,
          );
        }

        const data = (await response.json()) as JsonRpcResponse<T>;
        if (data.error) {
          // JSON-RPC error: don't retry (input is wrong, retry won't help).
          throw new LithoError(
            ErrorCode.CONTRACT_ERROR,
            `RPC error on ${method}: ${data.error.message}`,
          );
        }
        return data.result;
      } catch (err) {
        lastError = err;

        // Don't retry on validation / contract errors (LithoError with non-transient code).
        if (err instanceof LithoError && !isTransient(err.code)) {
          throw err;
        }

        if (attempt < this.retryCount) {
          // Exponential backoff: delay * 2^attempt
          await sleep(this.retryDelay * Math.pow(2, attempt));
          continue;
        }
      }
    }

    if (lastError instanceof LithoError) throw lastError;
    throw new LithoError(
      ErrorCode.NETWORK_ERROR,
      `RPC ${method} failed after ${this.retryCount + 1} attempts`,
      { cause: lastError as Error | undefined },
    );
  }

  /** @internal */
  private async fetchWithTimeout(init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(this.rpcUrl, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LithoError(ErrorCode.RPC_TIMEOUT, `RPC request timed out after ${this.timeout}ms`);
      }
      throw new LithoError(ErrorCode.NETWORK_ERROR, 'Network request failed', {
        cause: err as Error | undefined,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (not exported — implementation detail)
// ─────────────────────────────────────────────────────────────────────────────

function isTransient(code: ErrorCode): boolean {
  return (
    code === ErrorCode.NETWORK_ERROR ||
    code === ErrorCode.RPC_TIMEOUT ||
    code === ErrorCode.RATE_LIMITED
  );
}

function validateAddress(address: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new LithoError(ErrorCode.INVALID_ADDRESS, `Invalid address format: ${address}`);
  }
}

function validateHash(hash: string): void {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new LithoError(ErrorCode.INVALID_PARAMETER, `Invalid transaction hash: ${hash}`);
  }
}

function formatUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

function parseTransaction(raw: RawTransaction): TransactionResponse {
  return {
    hash: raw.hash,
    blockNumber: raw.blockNumber ? parseInt(raw.blockNumber, 16) : null,
    blockHash: raw.blockHash,
    transactionIndex: raw.transactionIndex ? parseInt(raw.transactionIndex, 16) : null,
    from: raw.from,
    to: raw.to,
    value: BigInt(raw.value),
    gasUsed: BigInt(raw.gas),
    gasPrice: BigInt(raw.gasPrice ?? '0x0'),
    status: raw.blockNumber ? 'confirmed' : 'pending',
  };
}

function parseReceipt(raw: RawReceipt): TransactionReceipt {
  return {
    transactionHash: raw.transactionHash,
    blockNumber: parseInt(raw.blockNumber, 16),
    blockHash: raw.blockHash,
    gasUsed: BigInt(raw.gasUsed),
    cumulativeGasUsed: BigInt(raw.cumulativeGasUsed),
    contractAddress: raw.contractAddress,
    status: parseInt(raw.status, 16) === 1 ? 1 : 0,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw JSON-RPC payload shapes (internal)
// ─────────────────────────────────────────────────────────────────────────────

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number;
  result: T;
  error?: { code: number; message: string };
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
  gasPrice?: string;
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
