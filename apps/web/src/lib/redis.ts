// REQ-0008 — Redis only when REDIS_URL is set (same gate as BullMQ workers)
import type Redis from "ioredis";

type RedisGlobal = typeof globalThis & { __pivotRedis?: Redis };

export function redisUrl(): string | undefined {
  const url = process.env.REDIS_URL?.trim();
  return url || undefined;
}

export async function getRedis(): Promise<Redis | null> {
  const url = redisUrl();
  if (!url) return null;
  const g = globalThis as RedisGlobal;
  if (g.__pivotRedis) return g.__pivotRedis;
  try {
    const { default: IORedis } = await import("ioredis");
    g.__pivotRedis = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    g.__pivotRedis.on("error", (error) => {
      console.warn("[Redis]", error instanceof Error ? error.message : error);
    });
    return g.__pivotRedis;
  } catch (error) {
    console.warn("[Redis] connect", error instanceof Error ? error.message : error);
    return null;
  }
}
