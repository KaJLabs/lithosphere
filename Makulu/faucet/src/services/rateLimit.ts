import Redis from 'ioredis';
import { config } from '../config.js';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      console.error('[faucet] Redis error:', err.message);
    });
  }
  return redis;
}

const KEY_PREFIX = 'faucet:cooldown:';

export async function checkCooldown(address: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const key = `${KEY_PREFIX}${address.toLowerCase()}`;
  const r = getRedis();

  try {
    await r.ping(); // ensure connected
  } catch {
    // Redis unavailable — allow the request (graceful degradation)
    console.warn('[faucet] Redis unavailable — skipping cooldown check');
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const ttl = await r.ttl(key);

  if (ttl > 0) {
    return { allowed: false, retryAfterSeconds: ttl };
  }

  // Set cooldown
  const cooldownSeconds = config.cooldownHours * 3600;
  await r.set(key, Date.now().toString(), 'EX', cooldownSeconds);

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
