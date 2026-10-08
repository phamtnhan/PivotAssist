// REQ-0020 / REQ-0029 — keyed rate limit; Redis when REDIS_URL (REQ-0008), else process-local Map
type Bucket = { count: number; resetAt: number };
type RedisLike = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
};

const stores = new Map<string, Map<string, Bucket>>();

function consumeMemory(
  storeId: string,
  key: string,
  max: number,
  windowMs: number,
  now: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  let store = stores.get(storeId);
  if (!store) {
    store = new Map();
    stores.set(storeId, store);
  }
  if (store.size > 10_000) {
    for (const [entryKey, bucket] of store) {
      if (now >= bucket.resetAt) store.delete(entryKey);
    }
  }
  const existing = store.get(key);
  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  existing.count += 1;
  if (existing.count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

async function redisForLimit(): Promise<RedisLike | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  const g = globalThis as typeof globalThis & { __pivotRedis?: RedisLike };
  if (g.__pivotRedis) return g.__pivotRedis;
  try {
    const ioredis = await import("ioredis");
    const Redis = ioredis.default;
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    client.on("error", (error) => {
      console.warn("[Redis]", error instanceof Error ? error.message : error);
    });
    g.__pivotRedis = client;
    return client;
  } catch (error) {
    console.warn("[KeyedLimit] redis connect", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function consumeKeyedLimit(
  storeId: string,
  key: string,
  max: number,
  windowMs: number,
  now?: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const clock = now ?? Date.now();
  if (now !== undefined) return consumeMemory(storeId, key, max, windowMs, clock);
  const redis = await redisForLimit().catch(() => null);
  if (!redis) return consumeMemory(storeId, key, max, windowMs, clock);
  try {
    const redisKey = `pa:kl:${storeId}:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.pexpire(redisKey, windowMs);
    if (count > max) {
      const ttl = await redis.pttl(redisKey);
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)),
      };
    }
    return { ok: true };
  } catch (error) {
    console.warn("[KeyedLimit] redis", error instanceof Error ? error.message : error);
    return consumeMemory(storeId, key, max, windowMs, clock);
  }
}

export function resetKeyedLimitStore(storeId: string) {
  stores.delete(storeId);
}
