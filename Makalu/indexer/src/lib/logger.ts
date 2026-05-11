import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

/**
 * Per-cycle context for the polling indexer. Each polling iteration generates
 * a `cycleId` so log lines for the same iteration can be grouped in Loki.
 * `blockHeight` is added once the cycle knows which block it's processing.
 */
export interface CycleContext {
  cycleId: string;
  blockHeight?: number;
}

export const cycleIdStore = new AsyncLocalStorage<CycleContext>();

export function currentCycleContext(): CycleContext | undefined {
  return cycleIdStore.getStore();
}

export function newCycleId(): string {
  return randomUUID();
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: process.env.OTEL_SERVICE_NAME || 'lithosphere-indexer' },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  mixin() {
    const ctx = currentCycleContext();
    return ctx ? { cycleId: ctx.cycleId, ...(ctx.blockHeight ? { blockHeight: ctx.blockHeight } : {}) } : {};
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Wraps fetch to forward the current cycleId as X-Request-Id. Downstream
 * services that also use the api's request-id middleware will adopt this
 * cycleId as their own correlation token, joining indexer cycles to api logs.
 */
export async function fetchWithCycleId(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
): Promise<Response> {
  const ctx = currentCycleContext();
  if (!ctx) {
    return fetch(input, init);
  }
  const headers = new Headers(init.headers);
  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', ctx.cycleId);
  }
  return fetch(input, { ...init, headers });
}
