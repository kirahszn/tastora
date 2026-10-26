// Simple fixed-window, in-memory rate limit per client key (IP). Per server instance only, so
// on Vercel it is a soft guard on API credit, not a hard global quota.
export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
}

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();

  return function check(key: string): RateLimitResult {
    const t = now();
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (t - w.start >= windowMs) windows.delete(k);
    }
    const w = windows.get(key);
    if (!w || t - w.start >= windowMs) {
      windows.set(key, { start: t, count: 1 });
      return { ok: true, retryAfter: 0 };
    }
    w.count += 1;
    return { ok: w.count <= limit, retryAfter: Math.ceil((w.start + windowMs - t) / 1000) };
  };
}

/** First address in x-forwarded-for (set by Vercel), else x-real-ip, else "unknown". */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}
