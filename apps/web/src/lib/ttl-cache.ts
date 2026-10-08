type CacheEntry<T> = { value: T; expiresAt: number };

/** Bounded TTL map — tránh cache không giới hạn (node skill / performance). */
export function createTtlCache<T>(maxEntries: number, ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | undefined {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T) {
      const now = Date.now();
      for (const [storedKey, entry] of store) {
        if (entry.expiresAt <= now) store.delete(storedKey);
      }
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: now + ttlMs });
    },
  };
}
