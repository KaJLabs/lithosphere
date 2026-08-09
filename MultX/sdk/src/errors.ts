import { ethers } from 'ethers';
import type { TokenMeta } from './types.js';

const ERC20_INSUFFICIENT_BALANCE = '0xe450d38c';
const ERC20_INSUFFICIENT_ALLOWANCE = '0xfb8f41b2';

const SEQUENCE_ERROR_PATTERNS = [
  /invalid nonce/i,
  /invalid sequence/i,
  /account sequence mismatch/i,
  /nonce too low/i,
  /nonce has already been used/i,
];

/**
 * Wallet-, RPC-, and contract-revert errors all use different shapes. We pick
 * a depth-first union of the most common paths and string-match on the joined
 * result to detect Cosmos-SDK / Ethermint sequence errors.
 */
export const isSequenceError = (err: unknown): boolean => {
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

const formatUnitsSafe = (value: unknown, decimals: number): string => {
  try {
    return ethers.formatUnits(
      ethers.toBigInt((value as string | number | bigint) ?? '0'),
      decimals,
    );
  } catch {
    return String(value);
  }
};

/**
 * Walk the nested error structure looking for hex revert data. Returns the
 * first 0x-prefixed hex string found, or `null` if none.
 */
export const findRevertData = (err: unknown): string | null => {
  const e = err as Record<string, any> | null | undefined;
  const candidates: unknown[] = [
    e?.data,
    e?.error?.data,
    e?.error?.error?.data,
    e?.error?.data?.originalError?.data,
    e?.info?.error?.data,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'string' &&
      candidate.startsWith('0x') &&
      candidate.length >= 10
    ) {
      return candidate;
    }
    const nested = (candidate as Record<string, any> | null | undefined)?.data;
    if (typeof nested === 'string' && nested.startsWith('0x')) {
      return nested;
    }
  }

  const message = String(e?.message || '');
  const dataMatch = message.match(/"data":"(0x[0-9a-fA-F]+)"/);
  return dataMatch ? dataMatch[1]! : null;
};

/**
 * Translate a raw bridge / contract / wallet error into a user-facing string.
 *
 * Recognised cases:
 *  - wallet rejection (`ACTION_REJECTED` or code `4001`) → "Transaction rejected in wallet"
 *  - ERC20 `0xe450d38c` insufficient balance → decoded balance vs needed
 *  - ERC20 `0xfb8f41b2` insufficient allowance → suggests re-approval
 *  - `execution reverted: <reason>` → extracted reason string
 *  - "insufficient funds" → "Insufficient native LITHO for gas"
 *  - sequence/nonce errors → MetaMask reset instructions
 *  - ethers `UNPREDICTABLE_GAS_LIMIT` → "Bridge call would revert ..."
 *  - fallback → first line of the message, truncated to 200 chars
 */
export const decodeBridgeError = (err: unknown, context: TokenMeta = {}): string => {
  const e = err as Record<string, any> | null | undefined;

  if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) {
    return 'Transaction rejected in wallet';
  }

  const tokenSymbol = context.symbol ?? 'token';
  const decimals = Number.isFinite(context.decimals) ? Number(context.decimals) : 18;
  const data = findRevertData(err);

  if (data) {
    const selector = data.slice(0, 10).toLowerCase();

    if (selector === ERC20_INSUFFICIENT_BALANCE && data.length >= 10 + 64 * 3) {
      const balance = '0x' + data.slice(10 + 64, 10 + 64 * 2);
      const needed = '0x' + data.slice(10 + 64 * 2, 10 + 64 * 3);
      return `Insufficient ${tokenSymbol} balance: have ${formatUnitsSafe(balance, decimals)}, need ${formatUnitsSafe(needed, decimals)}`;
    }

    if (selector === ERC20_INSUFFICIENT_ALLOWANCE && data.length >= 10 + 64 * 3) {
      const allowance = '0x' + data.slice(10 + 64, 10 + 64 * 2);
      const needed = '0x' + data.slice(10 + 64 * 2, 10 + 64 * 3);
      return `Insufficient bridge allowance: approved ${formatUnitsSafe(allowance, decimals)}, need ${formatUnitsSafe(needed, decimals)}. Re-run the approval step.`;
    }
  }

  const message = String(e?.reason || e?.shortMessage || e?.message || '');
  const reasonMatch = message.match(
    /(?:execution reverted|reverted with reason string):?\s*['"]?([^'"\\\n]+)['"]?/i,
  );
  if (reasonMatch?.[1]) {
    return reasonMatch[1].trim();
  }

  if (/insufficient funds/i.test(message)) {
    return 'Insufficient native LITHO for gas';
  }

  if (isSequenceError(err)) {
    return 'Wallet nonce out of sync with the chain. Open MetaMask → Settings → Advanced → "Clear activity and nonce data" (with Kamet selected), then refresh and try again.';
  }

  if (e?.code === 'UNPREDICTABLE_GAS_LIMIT') {
    return 'Bridge call would revert (check token balance, approval, and supported-token list)';
  }

  return message.split('\n')[0]!.slice(0, 200) || 'Bridge transaction failed';
};

/**
 * Custom error class produced by MultXClient operations. The decoded
 * user-facing message is in `.message`; the original underlying error is in
 * `.cause` so callers can still inspect the raw RPC payload.
 */
export class MultXError extends Error {
  override readonly cause?: unknown;

  constructor(decodedMessage: string, cause?: unknown) {
    super(decodedMessage);
    this.name = 'MultXError';
    if (cause !== undefined) this.cause = cause;
  }
}
