import { Redis } from 'ioredis';
import { logger } from './logger.js';

// Cross-instance cache for a SMALL fixed set of expensive, shared values
// (stats summary, big aggregate counts, the integrity CTE). The Makalu API
// runs multiple replicas behind the load balancer, each with its own in-memory
// cache — so a request landing on a replica whose local cache is cold used to
// recompute the ~7s aggregates over ~5M rows. Backing those few keys with Redis
// lets every replica share one warm copy.
//
// Layered: in-memory first (avoids a Redis round-trip on the hot path), then
// Redis (shared across replicas), then compute. Degrades gracefully — if Redis
// is unavailable the in-memory layer still works exactly like the old per-
// instance cache, so the API never depends on Redis being up.

let client: Redis | null = null;
let redisReady = false;
let initialised = false;

function getClient(): Redis | null {
  if (initialised) return client;
  initialised = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.info('[shared-cache] REDIS_URL not set — using in-memory cache only');
    return null;
  }

  try {
    client = new Redis(url, {
      // Fail fast and never block a request on a flaky Redis: no offline queue,
      // a single retry, short connect timeout. On any trouble we fall back to
      // the in-memory layer / direct compute.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
    });
    client.on('ready', () => { redisReady = true; logger.info('[shared-cache] redis ready'); });
    client.on('error', (err: Error) => {
      if (redisReady) logger.warn({ err: err.message }, '[shared-cache] redis error');
      redisReady = false;
    });
    client.on('end', () => { redisReady = false; });
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, '[shared-cache] redis init failed');
    client = null;
  }
  return client;
}

interface MemEntry { value: unknown; expiresAt: number }
const mem = new Map<string, MemEntry>();
const pending = new Map<string, Promise<unknown>>();

/**
 * Get `key` from (in-memory → Redis → loader), caching the result in both layers
 * for `ttlMs`. Per-instance in-flight de-duplication prevents a local stampede
 * when several requests miss at once. Value must be JSON-serialisable.
 */
export async function loadCachedShared<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();

  const local = mem.get(key);
  if (local && local.expiresAt > now) return local.value as T;

  const c = getClient();
  if (c && redisReady) {
    try {
      const raw = await c.get(key);
      if (raw != null) {
        const value = JSON.parse(raw) as T;
        mem.set(key, { value, expiresAt: now + ttlMs });
        return value;
      }
    } catch (err) {
      logger.warn({ key, err: err instanceof Error ? err.message : String(err) }, '[shared-cache] redis get failed');
    }
  }

  const inflight = pending.get(key) as Promise<T> | undefined;
  if (inflight) return inflight;

  const promise = (async () => {
    const value = await loader();
    mem.set(key, { value, expiresAt: Date.now() + ttlMs });
    const cc = getClient();
    if (cc && redisReady) {
      try { await cc.set(key, JSON.stringify(value), 'PX', ttlMs); } catch (err) {
        logger.warn({ key, err: err instanceof Error ? err.message : String(err) }, '[shared-cache] redis set failed');
      }
    }
    return value;
  })().finally(() => pending.delete(key));

  pending.set(key, promise as Promise<unknown>);
  return promise;
}
