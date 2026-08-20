import { ethers } from 'ethers';
import type { Contract, Signer } from 'ethers';

import { bridgeAbi, tokenAbi } from './abis.js';
import { MultXApi, readJsonResponse } from './api.js';
import { MultXError, decodeBridgeError } from './errors.js';
import { isContractDeployed } from './format.js';
import type {
  ApproveTokenOptions,
  BridgeStatusResponse,
  BridgeTransaction,
  DestinationChain,
  GetStatusOptions,
  LockResult,
  LockTokensOptions,
  MultXConfig,
  SupportedToken,
} from './types.js';

const DEFAULT_CHAINS: Record<string, number> = {
  lithosphere: 900523,
  ethereum: 1,
};

interface BridgeTerminalError extends Error {
  bridgeTerminal?: boolean;
}

/**
 * Submit a contract call with explicit-nonce retry on Cosmos-SDK / Ethermint
 * "invalid nonce: got X, expected Y" errors. MetaMask (or any wallet whose RPC
 * trails the chain by a block) can hand back a stale `pending` count after a
 * recent tx — we retry once with the freshly-queried pending nonce.
 */
const sendWithNonceRetry = async (
  signer: Signer,
  contract: Contract,
  method: string,
  args: unknown[],
): Promise<ethers.ContractTransactionResponse> => {
  try {
    return await contract[method]!(...args);
  } catch (err) {
    if (!isSequenceErrorLike(err)) throw err;

    let from: string;
    try {
      from = await signer.getAddress();
    } catch {
      throw err;
    }

    const provider = signer.provider;
    if (!provider?.getTransactionCount) throw err;

    let nonce: number;
    try {
      nonce = await provider.getTransactionCount(from, 'pending');
    } catch {
      throw err;
    }

    return contract[method]!(...args, { nonce });
  }
};

const SEQUENCE_ERROR_PATTERNS = [
  /invalid nonce/i,
  /invalid sequence/i,
  /account sequence mismatch/i,
  /nonce too low/i,
  /nonce has already been used/i,
];

const isSequenceErrorLike = (err: unknown): boolean => {
  const e = err as Record<string, any> | null | undefined;
  const haystack = [
    e?.message,
    e?.reason,
    e?.shortMessage,
    e?.error?.message,
    e?.error?.error?.message,
    e?.info?.error?.message,
    e?.data?.message,
  ]
    .filter(Boolean)
    .join(' ');
  return SEQUENCE_ERROR_PATTERNS.some((rx) => rx.test(haystack));
};

/**
 * Framework-agnostic MultX bridge client. Wraps the on-chain contract calls,
 * bridge backend HTTP API, and signature polling logic. All methods that
 * mutate on-chain state require a `signer` to be supplied via the options bag.
 *
 * Construct one of these per app/session and pass it down (e.g. via React
 * context). The client itself holds no transient state — UI state lives in
 * the React adapter or the consumer's own state container.
 */
export class MultXClient {
  readonly bridgeAddress: string;
  readonly bridgeApiUrl: string;
  readonly supportedTokens: SupportedToken[];
  readonly destinationChains: DestinationChain[];
  readonly lithoTokenAddress: string;
  readonly chains: Record<string, number>;
  readonly api: MultXApi;

  constructor(config: MultXConfig) {
    this.bridgeAddress = config.bridgeAddress ?? '';
    this.bridgeApiUrl = config.bridgeApiUrl ?? '';
    this.supportedTokens = [...(config.supportedTokens ?? [])];
    this.destinationChains = [...(config.destinationChains ?? [])];
    this.lithoTokenAddress = config.lithoTokenAddress ?? '';
    this.chains = { ...DEFAULT_CHAINS, ...(config.chains ?? {}) };
    this.api = new MultXApi(this.bridgeApiUrl, config.fetch);
  }

  /** True iff the configured bridge address parses as a valid EVM address. */
  isContractDeployed(): boolean {
    return isContractDeployed(this.bridgeAddress);
  }

  /**
   * Approve the bridge contract to spend `amount` of `tokenAddress` on behalf
   * of the signer. Returns the approval transaction hash on success. Throws a
   * {@link MultXError} with a decoded message otherwise.
   */
  async approveToken(opts: ApproveTokenOptions): Promise<string> {
    if (!opts.signer) {
      throw new Error('Wallet not connected');
    }
    if (!this.isContractDeployed()) {
      throw new Error('MultX Bridge contract not deployed');
    }

    try {
      const tokenContract = new ethers.Contract(
        opts.tokenAddress,
        tokenAbi as unknown as string[],
        opts.signer,
      );
      const tx = await sendWithNonceRetry(
        opts.signer,
        tokenContract,
        'approve',
        [this.bridgeAddress, ethers.toBigInt(opts.amount as ethers.BigNumberish)],
      );

      const receipt = await tx.wait();
      if (receipt?.status === 1) {
        return tx.hash;
      }
      throw new Error('Approval transaction failed');
    } catch (err) {
      const decoded = decodeBridgeError(err, opts.tokenMeta);
      throw new MultXError(decoded, err);
    }
  }

  /**
   * Lock `amount` of `tokenAddress` on Kamet to bridge to `targetChainId`.
   * Pre-flight checks balance and allowance against the bridge before sending.
   * Returns `{ txHash, blockNumber, transactionIndex }` on success.
   */
  async lockTokens(opts: LockTokensOptions): Promise<LockResult> {
    if (!opts.signer) {
      throw new Error('Wallet not connected');
    }
    if (!this.isContractDeployed()) {
      throw new Error('MultX Bridge contract not deployed');
    }

    try {
      const bridgeContract = new ethers.Contract(
        this.bridgeAddress,
        bridgeAbi as unknown as string[],
        opts.signer,
      );
      const tokenContract = new ethers.Contract(
        opts.tokenAddress,
        tokenAbi as unknown as string[],
        opts.signer,
      );

      const amountBN = ethers.toBigInt(opts.amount as ethers.BigNumberish);
      const userAddress = await opts.signer.getAddress();

      const [balance, allowance, supported, routeSupported] = await Promise.all([
        tokenContract.balanceOf!(userAddress) as Promise<bigint>,
        tokenContract.allowance!(userAddress, this.bridgeAddress) as Promise<bigint>,
        // `supportedTokens` is the deployed contract's public mapping getter.
        // Default to `true` on RPC failure so a flaky read never blocks a lock
        // the on-chain `require(supportedTokens[token])` would anyway enforce.
        (bridgeContract.supportedTokens!(opts.tokenAddress) as Promise<boolean>).catch(() => true),
        (bridgeContract.supportedRoutes!(opts.tokenAddress, opts.targetChainId) as Promise<boolean>).catch(() => true),
      ]);

      if (!supported) {
        throw new Error(
          `${opts.tokenMeta?.symbol || 'Token'} is not on the bridge supported-token list`,
        );
      }
      if (!routeSupported) {
        throw new Error(
          `${opts.tokenMeta?.symbol || 'Token'} is not approved for destination chain ${opts.targetChainId}`,
        );
      }

      if (balance < amountBN) {
        const decimals = Number.isFinite(opts.tokenMeta?.decimals)
          ? Number(opts.tokenMeta!.decimals)
          : 18;
        throw new Error(
          `Insufficient ${opts.tokenMeta?.symbol || 'token'} balance: have ${ethers.formatUnits(balance, decimals)}, need ${ethers.formatUnits(amountBN, decimals)}`,
        );
      }

      if (allowance < amountBN) {
        throw new Error(
          'Bridge allowance is below the requested amount — re-run the approval step',
        );
      }

      const tx = await sendWithNonceRetry(opts.signer, bridgeContract, 'lockTokens', [
        opts.tokenAddress,
        amountBN,
        opts.targetChainId,
      ]);

      const receipt = await tx.wait();
      if (receipt?.status === 1) {
        return {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          transactionIndex: receipt.index,
        };
      }
      throw new Error('Lock transaction failed');
    } catch (err) {
      const decoded = decodeBridgeError(err, opts.tokenMeta);
      throw new MultXError(decoded, err);
    }
  }

  /**
   * Poll the bridge backend for a final status. Backs off from 5s up to 30s
   * between attempts and gives up after `maxAttempts` (default 60). 4xx
   * responses are treated as terminal and re-thrown immediately.
   */
  async getStatus(
    txHashValue: string,
    opts: GetStatusOptions = {},
  ): Promise<BridgeStatusResponse> {
    if (!this.isContractDeployed()) {
      throw new Error('MultX Bridge contract not deployed');
    }
    if (!txHashValue) {
      throw new Error('Transaction hash required');
    }

    const maxAttempts = opts.maxAttempts ?? 60;
    const endpoint = this.api.urls.status(txHashValue);
    let attempts = 0;
    let waitingNotified = false;

    while (attempts < maxAttempts) {
      try {
        const response = await this.api.fetch(endpoint);
        const data = (await readJsonResponse(response)) as BridgeStatusResponse & {
          error?: string;
        };

        if (!response.ok) {
          const apiError: BridgeTerminalError = new Error(
            data?.error || `API error: ${response.status}`,
          );
          apiError.bridgeTerminal = response.status >= 400 && response.status < 500;
          throw apiError;
        }

        if (data.status === 'completed') {
          return data;
        }

        if (data.status === 'failed') {
          const failedError: BridgeTerminalError = new Error(
            data.failureReason || 'Bridge transaction failed',
          );
          failedError.bridgeTerminal = true;
          throw failedError;
        }

        if (
          data.status === 'locked' ||
          data.status === 'signing' ||
          data.status === 'signed'
        ) {
          if (!waitingNotified) {
            opts.onWaitingSignatures?.();
            waitingNotified = true;
          }
        }

        const waitTime = Math.min(5000 + attempts * 1000, 30000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        attempts += 1;
      } catch (err) {
        if ((err as BridgeTerminalError)?.bridgeTerminal) {
          throw err;
        }
        // Transient — log and retry
        // eslint-disable-next-line no-console
        console.warn('Bridge status check failed:', err);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts += 1;
      }
    }

    throw new Error('Bridge transaction timeout - please check status manually');
  }

  /** Fetch the current set of validator signatures collected for `txHash`. */
  async getSignatures(txHashValue: string): Promise<string[]> {
    if (!this.isContractDeployed()) {
      throw new Error('MultX Bridge contract not deployed');
    }

    const endpoint = this.api.urls.signatures(txHashValue);
    const response = await this.api.fetch(endpoint);
    const data = (await readJsonResponse(response)) as { signatures?: unknown; error?: string };

    if (!response.ok) {
      throw new Error(data?.error || `Failed to fetch signatures: ${response.status}`);
    }

    return Array.isArray(data.signatures) ? (data.signatures as string[]) : [];
  }

  /**
   * Fetch this address's bridge transaction history. Returns `[]` rather than
   * throwing on 404 or transport errors, matching kamet-explorer's "best
   * effort, never break the page" pattern.
   */
  async getHistory(address: string): Promise<BridgeTransaction[]> {
    if (!this.isContractDeployed()) {
      return [];
    }

    try {
      const endpoint = this.api.urls.transactions(address);
      const response = await this.api.fetch(endpoint);
      const data = (await readJsonResponse(response)) as {
        transactions?: unknown;
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(data?.error || `Failed to fetch history: ${response.status}`);
      }

      return Array.isArray(data.transactions) ? (data.transactions as BridgeTransaction[]) : [];
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch bridge history:', (err as Error)?.message);
      return [];
    }
  }
}
