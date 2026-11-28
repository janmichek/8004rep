/** A fixed-TTL cache for the single Bun server instance; the edge function relies on CDN caching. */
export type TtlCache<T> = {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Stores at most `maxEntries` values for `ttlMs`. Reads do not extend the TTL,
 * and a full cache evicts the oldest entry before adding another.
 */
export function createTtlCache<T>(
  ttlMs: number,
  maxEntries: number,
  now: () => number
): TtlCache<T> {
  const entries = new Map<string, CacheEntry<T>>();

  return {
    get(key) {
      const entry = entries.get(key);

      if (entry === undefined) return undefined;

      if (entry.expiresAt <= now()) {
        entries.delete(key);

        return undefined;
      }

      return entry.value;
    },
    set(key, value) {
      if (maxEntries <= 0) return;

      if (entries.size >= maxEntries && !entries.has(key)) {
        const oldest = entries.keys().next();

        if (!oldest.done) entries.delete(oldest.value);
      }

      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
  };
}
