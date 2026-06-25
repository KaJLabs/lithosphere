import { LithoClient, LithoError, ErrorCode } from '@lithosphere/sdk';

import type { TransactionResponse, TransactionReceipt } from '@lithosphere/sdk';

/**
 * Example of layering domain-specific helpers on top of `@lithosphere/sdk`.
 *
 * The official SDK ships the primitives (`getBalance`, `getBlockNumber`,
 * `getTransaction`, etc.) and the typed errors. Most apps end up wanting
 * higher-level reads — "what has this address done recently?", "did this
 * batch settle?", "is this tx finalized?" — that are easy to build on top.
 *
 * The pattern: own a `LithoClient`, expose your own methods, let the SDK
 * handle retry / backoff / typed errors at the RPC layer.
 *
 * Replace the body of this class with your project's actual needs. Delete
 * the example entirely if it's not relevant — the structure is the point.
 */

export interface RecentActivityEntry {
  hash: string;
  blockNumber: number | null;
  to: string | null;
  value: string;
  status: 'success' | 'failure' | 'pending';
}

export interface RecentActivity {
  address: string;
  count: number;
  entries: RecentActivityEntry[];
}

export class LithosphereExtensions {
  constructor(private readonly client: LithoClient) {}

  /**
   * Example domain method: fetch a list of recent transactions touching
   * `address` by hashes the caller already knows. The SDK doesn't ship an
   * indexer-style "give me everything for this address" call (that's
   * inherently an indexer concern, not a node concern), but composing
   * known hashes into a typed batch result is the kind of helper a
   * dapp ends up needing.
   */
  async recentActivity(
    address: string,
    hashes: readonly string[],
  ): Promise<RecentActivity> {
    if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
      throw new LithoError(
        ErrorCode.INVALID_ADDRESS,
        `recentActivity: '${address}' is not a 0x-prefixed 20-byte hex address`,
      );
    }

    const entries: RecentActivityEntry[] = await Promise.all(
      hashes.map(async (hash): Promise<RecentActivityEntry> => {
        const tx = await this.client.getTransaction(hash);
        const receipt = await this.client.getTransactionReceipt(hash);
        return summarizeTransaction(hash, tx, receipt);
      }),
    );

    return { address, count: entries.length, entries };
  }
}

function summarizeTransaction(
  hash: string,
  tx: TransactionResponse | null,
  receipt: TransactionReceipt | null,
): RecentActivityEntry {
  if (!tx) {
    return { hash, blockNumber: null, to: null, value: '0', status: 'pending' };
  }
  // tx.value is bigint; serialize it to a decimal string so the entry can
  // round-trip through JSON without losing precision.
  const valueAsString = typeof tx.value === 'bigint' ? tx.value.toString() : String(tx.value ?? '0');
  if (!receipt) {
    return {
      hash,
      blockNumber: tx.blockNumber ?? null,
      to: tx.to ?? null,
      value: valueAsString,
      status: 'pending',
    };
  }
  // TransactionReceipt.status is 0 | 1 (EVM convention). Map to the
  // friendlier string the activity feed displays.
  return {
    hash,
    blockNumber: receipt.blockNumber,
    to: tx.to ?? null,
    value: valueAsString,
    status: receipt.status === 1 ? 'success' : 'failure',
  };
}
