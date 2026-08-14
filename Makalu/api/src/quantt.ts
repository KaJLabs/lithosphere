export const QUANTT_RESEARCH_URL = 'https://research.quantt.at/';
export const QUANTT_DEVELOPER_URL = 'https://dev.quantt.at/';

export type QuanttAuthHeader = 'Authorization' | 'X-API-Key';

export interface QuanttConfig {
  baseUrl: URL;
  apiKey: string;
  authHeader: QuanttAuthHeader;
  insightsPath: string;
  timeoutMs: number;
}

function isQuanttHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'quantt.at' || normalized.endsWith('.quantt.at');
}

export function loadQuanttConfig(env: NodeJS.ProcessEnv = process.env): QuanttConfig | null {
  const rawBaseUrl = env.QUANTT_API_BASE_URL?.trim();
  const apiKey = env.QUANTT_API_KEY?.trim();
  if (!rawBaseUrl || !apiKey) return null;

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    return null;
  }

  if (baseUrl.protocol !== 'https:'
    || !isQuanttHostname(baseUrl.hostname)
    || baseUrl.username
    || baseUrl.password
    || baseUrl.search
    || baseUrl.hash) return null;

  const requestedHeader = env.QUANTT_API_AUTH_HEADER?.trim().toLowerCase();
  let authHeader: QuanttAuthHeader;
  if (requestedHeader === 'x-api-key') authHeader = 'X-API-Key';
  else if (requestedHeader === 'authorization') authHeader = 'Authorization';
  else return null;

  // The Quantt API contract has not been published. Require the owner-supplied
  // path instead of activating against a guessed endpoint.
  const insightsPath = env.QUANTT_INSIGHTS_PATH?.trim();
  if (!insightsPath) return null;
  if (!insightsPath.startsWith('/') || insightsPath.startsWith('//')) return null;

  const requestedTimeout = Number(env.QUANTT_API_TIMEOUT_MS ?? 10_000);
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.min(30_000, Math.max(1_000, Math.trunc(requestedTimeout)))
    : 10_000;

  return { baseUrl, apiKey, authHeader, insightsPath, timeoutMs };
}

export function buildQuanttInsightsUrl(config: QuanttConfig, symbol: string): URL {
  const url = new URL(config.insightsPath, config.baseUrl);
  if (url.protocol !== 'https:' || !isQuanttHostname(url.hostname)) {
    throw new Error('Invalid Quantt upstream URL');
  }
  url.searchParams.set('symbol', symbol);
  return url;
}

export function quanttAuthHeaders(config: QuanttConfig): Record<string, string> {
  return config.authHeader === 'X-API-Key'
    ? { 'X-API-Key': config.apiKey, Accept: 'application/json' }
    : { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' };
}
