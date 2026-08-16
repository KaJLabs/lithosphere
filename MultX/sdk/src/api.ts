import { normalizeBridgeApiBaseUrl } from './history.js';
import type { FetchLike } from './types.js';

/**
 * Builds bridge backend URLs and performs HTTP calls. Pure URL helpers are
 * exposed via {@link MultXApi.urls} so callers can construct URLs without
 * issuing requests (useful in tests).
 */
export class MultXApi {
  /** Normalized base URL (no trailing slash, no `/bridge` suffix). */
  readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl: string, fetchImpl?: FetchLike) {
    this.baseUrl = normalizeBridgeApiBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /** URL builders. Equivalent to the `MultXAPI` namespace from kamet-explorer. */
  urls = {
    health: (): string => `${this.baseUrl}/health`,
    status: (txHash: string): string => `${this.baseUrl}/bridge/status/${txHash}`,
    signatures: (txHash: string): string =>
      `${this.baseUrl}/bridge/signatures/${txHash}`,
    transactions: (address: string): string =>
      `${this.baseUrl}/bridge/transactions/${address}`,
    tokenInfo: (tokenAddress: string): string =>
      `${this.baseUrl}/tokens/${tokenAddress}`,
    chains: (): string => `${this.baseUrl}/chains`,
  };

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    return this.fetchImpl(input, init);
  }
}

/**
 * Best-effort JSON parse. Returns `{}` for empty bodies or invalid JSON,
 * matching the lenient behaviour used by the kamet-explorer hook.
 */
export const readJsonResponse = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
};
