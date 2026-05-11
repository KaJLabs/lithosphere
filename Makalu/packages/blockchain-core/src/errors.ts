/**
 * Typed error codes used by every SDK package. Consumers can switch on
 * `err.code` to recover from specific failure modes.
 */
export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_NOT_FOUND = 'NETWORK_NOT_FOUND',
  INVALID_CHAIN_ID = 'INVALID_CHAIN_ID',
  RPC_TIMEOUT = 'RPC_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
}

/**
 * Single error type emitted from anywhere in the SDK. Always carries a
 * machine-readable `code` so consumers can `instanceof LithoError`
 * and `switch (err.code)`.
 *
 * @example
 * ```ts
 * import { LithoError, ErrorCode } from '@lithosphere/blockchain-core';
 *
 * try {
 *   await client.getBalance(addr);
 * } catch (err) {
 *   if (err instanceof LithoError && err.code === ErrorCode.RPC_TIMEOUT) {
 *     // retry / surface a friendly message
 *   }
 * }
 * ```
 */
export class LithoError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = 'LithoError';
    // Preserve prototype chain when transpiled to ES5
    Object.setPrototypeOf(this, LithoError.prototype);
  }
}
