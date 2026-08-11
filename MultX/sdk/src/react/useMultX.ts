import { useCallback, useState } from 'react';
import type { Signer } from 'ethers';

import type { MultXClient } from '../client.js';
import { MULTX_STEPS, type MultXStep } from '../states.js';
import { MultXError } from '../errors.js';
import type {
  BridgeStatusResponse,
  BridgeTransaction,
  GetStatusOptions,
  LockResult,
  TokenMeta,
} from '../types.js';

export interface UseMultXOptions {
  /** Pre-constructed client (typically singleton-memoized at app boot). */
  client: MultXClient;
  /** Wallet signer; can be `null` while disconnected. */
  signer: Signer | null | undefined;
}

export interface UseMultXResult {
  loading: boolean;
  error: string | null;
  txHash: string | null;
  step: MultXStep;
  bridgeHistory: BridgeTransaction[];
  approveToken: (
    tokenAddress: string,
    amount: string | bigint | number,
    tokenMeta?: TokenMeta,
  ) => Promise<string>;
  lockTokens: (
    tokenAddress: string,
    amount: string | bigint | number,
    targetChainId: number,
    tokenMeta?: TokenMeta,
  ) => Promise<LockResult>;
  getBridgeStatus: (
    txHashValue: string,
    maxAttempts?: number,
  ) => Promise<BridgeStatusResponse>;
  getBridgeSignatures: (txHashValue: string) => Promise<string[]>;
  getBridgeHistory: (address: string) => Promise<BridgeTransaction[]>;
  reset: () => void;
  isContractDeployed: boolean;
}

/**
 * Thin React adapter over {@link MultXClient}. Mirrors the surface of the
 * original `useMultX` hook in kamet-explorer — same return shape, same
 * argument order — so consumers can swap the import path without other code
 * changes.
 */
export const useMultX = ({ client, signer }: UseMultXOptions): UseMultXResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [step, setStep] = useState<MultXStep>(MULTX_STEPS.IDLE);
  const [bridgeHistory, setBridgeHistory] = useState<BridgeTransaction[]>([]);

  const approveToken = useCallback<UseMultXResult['approveToken']>(
    async (tokenAddress, amount, tokenMeta = {}) => {
      if (!signer) throw new Error('Wallet not connected');
      try {
        setLoading(true);
        setError(null);
        setStep(MULTX_STEPS.APPROVING);
        const hash = await client.approveToken({
          signer,
          tokenAddress,
          amount,
          tokenMeta,
        });
        setStep(MULTX_STEPS.APPROVED);
        return hash;
      } catch (err) {
        const message = err instanceof MultXError ? err.message : (err as Error)?.message || 'Approval failed';
        setStep(MULTX_STEPS.ERROR);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer],
  );

  const lockTokens = useCallback<UseMultXResult['lockTokens']>(
    async (tokenAddress, amount, targetChainId, tokenMeta = {}) => {
      if (!signer) throw new Error('Wallet not connected');
      try {
        setLoading(true);
        setError(null);
        setStep(MULTX_STEPS.LOCKING);
        const result = await client.lockTokens({
          signer,
          tokenAddress,
          amount,
          targetChainId,
          tokenMeta,
        });
        setTxHash(result.txHash);
        setStep(MULTX_STEPS.LOCKED);
        return result;
      } catch (err) {
        const message = err instanceof MultXError ? err.message : (err as Error)?.message || 'Lock failed';
        setStep(MULTX_STEPS.ERROR);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer],
  );

  const getBridgeStatus = useCallback<UseMultXResult['getBridgeStatus']>(
    async (txHashValue, maxAttempts = 60) => {
      try {
        const opts: GetStatusOptions = {
          maxAttempts,
          onWaitingSignatures: () => setStep(MULTX_STEPS.WAITING_SIGNATURES),
        };
        const data = await client.getStatus(txHashValue, opts);
        if (data.status === 'completed') setStep(MULTX_STEPS.COMPLETED);
        return data;
      } catch (err) {
        setStep(MULTX_STEPS.ERROR);
        setError((err as Error)?.message || 'Bridge status check failed');
        throw err;
      }
    },
    [client],
  );

  const getBridgeSignatures = useCallback<UseMultXResult['getBridgeSignatures']>(
    async (txHashValue) => {
      try {
        return await client.getSignatures(txHashValue);
      } catch (err) {
        setError((err as Error)?.message || 'Signatures fetch failed');
        throw err;
      }
    },
    [client],
  );

  const getBridgeHistory = useCallback<UseMultXResult['getBridgeHistory']>(
    async (address) => {
      try {
        setLoading(true);
        setError(null);
        const transactions = await client.getHistory(address);
        setBridgeHistory(transactions);
        return transactions;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setTxHash(null);
    setStep(MULTX_STEPS.IDLE);
    setBridgeHistory([]);
  }, []);

  return {
    loading,
    error,
    txHash,
    step,
    bridgeHistory,
    approveToken,
    lockTokens,
    getBridgeStatus,
    getBridgeSignatures,
    getBridgeHistory,
    reset,
    isContractDeployed: client.isContractDeployed(),
  };
};
