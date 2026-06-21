type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  /** Max events allowed in the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

function pruneStale(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= windowMs) {
      buckets.delete(key);
    }
  }
}

/** In-memory sliding-window rate limiter (single Node process). */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  pruneStale(now, config.windowMs);

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= config.windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  if (bucket.count >= config.limit) {
    const retryAfterMs = config.windowMs - (now - bucket.windowStart);
    return { allowed: false, retryAfterMs: Math.max(1, retryAfterMs) };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
