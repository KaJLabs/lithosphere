import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

/**
 * Per-request context, scoped via AsyncLocalStorage so any `await` inside a
 * request handler can read the current requestId without it being threaded
 * through every function signature.
 */
export interface RequestContext {
  requestId: string;
}

export const requestIdStore = new AsyncLocalStorage<RequestContext>();

/** Returns the current requestId if inside a request, otherwise undefined. */
export function currentRequestId(): string | undefined {
  return requestIdStore.getStore()?.requestId;
}

/**
 * Root logger. JSON output by default — Loki and Promtail (already running in
 * Makalu/infra/) ingest this natively, so every `logger.info(...)` becomes a
 * full-text-searchable record in Grafana.
 *
 * In development (`NODE_ENV !== 'production'`), prettify for human readability
 * if `pino-pretty` happens to be installed (lazy fallback to JSON otherwise).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: process.env.OTEL_SERVICE_NAME || 'lithosphere-api' },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  mixin() {
    // Stamp every log line with the current requestId when one is in scope.
    const requestId = currentRequestId();
    return requestId ? { requestId } : {};
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Reads `X-Request-Id` from the incoming request or generates a UUID if none
 * was provided. Header propagates upstream → us → downstream so a request
 * crossing api → indexer → cosmos-rpc carries the same correlation id.
 */
export function resolveRequestId(headerValue: string | string[] | undefined): string {
  if (typeof headerValue === 'string' && headerValue.length > 0) {
    return headerValue;
  }
  if (Array.isArray(headerValue) && headerValue[0]) {
    return headerValue[0];
  }
  return randomUUID();
}

/**
 * Wraps global `fetch` to forward the current requestId as `X-Request-Id`.
 * Calls made outside a request context fall through to plain fetch.
 *
 * Use this in place of `fetch` inside route handlers — the indexer, explorer
 * proxy, and Cosmos RPC calls all benefit.
 */
export async function fetchWithRequestId(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const requestId = currentRequestId();
  if (!requestId) {
    return fetch(input, init);
  }
  const headers = new Headers(init.headers);
  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', requestId);
  }
  return fetch(input, { ...init, headers });
}
