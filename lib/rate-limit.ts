// Lightweight in-memory rate limiter (token-bucket style fixed window).
//
// This is intentionally simple and process-local. For multi-instance
// deployments swap this for a Redis-backed limiter (e.g. with BullMQ/Upstash);
// the call sites only depend on the `checkRateLimit` signature.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * @param key      Unique identifier for the caller (e.g. `upload:<userId>`).
 * @param limit    Max requests allowed within the window.
 * @param windowMs Window length in milliseconds.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

// Opportunistic cleanup so the map does not grow unbounded.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  // Do not keep the event loop alive solely for cleanup.
  if (typeof timer.unref === "function") timer.unref();
}
