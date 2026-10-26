// Tiny in-memory TTL cache for Qloo responses, keyed by path + params. Per server instance only
// (no shared store); it saves API credit on repeated searches and makes the no-signal baseline
// free when the main search had no signals. In-flight promises are cached too, so identical
// parallel requests share one call. Failures are never cached.
export const QLOO_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

interface Entry {
  expires: number;
  value: Promise<unknown>;
}

export class TtlCache {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs = QLOO_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns the cached value, or runs `load` and caches its result. `hit` says which. */
  async getOrLoad(key: string, load: () => Promise<unknown>): Promise<{ value: unknown; hit: boolean }> {
    const t = this.now();
    const cached = this.entries.get(key);
    if (cached && cached.expires > t) return { value: await cached.value, hit: true };

    const value = load();
    this.entries.set(key, { expires: t + this.ttlMs, value });
    if (this.entries.size > MAX_ENTRIES) this.evictExpired(t);
    try {
      return { value: await value, hit: false };
    } catch (err) {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
      throw err;
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private evictExpired(t: number): void {
    for (const [k, e] of this.entries) if (e.expires <= t) this.entries.delete(k);
    // Still too big: drop the oldest insertions.
    for (const k of this.entries.keys()) {
      if (this.entries.size <= MAX_ENTRIES) break;
      this.entries.delete(k);
    }
  }
}

/** Stable key: path plus params sorted by name. */
export function cacheKey(path: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
    .map((k) => [k, params[k]]);
  return `${path}?${JSON.stringify(sorted)}`;
}
