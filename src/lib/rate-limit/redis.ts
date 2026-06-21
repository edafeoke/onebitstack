import IORedis from "ioredis";
import { isRedisQueueEnabled, resolveRedisUrl } from "@/lib/queue/redis";
import type { RateLimitConfig, RateLimitResult } from "@/lib/rate-limit/memory";

let client: IORedis | undefined;

function getClient(): IORedis {
  if (!client) {
    client = new IORedis(resolveRedisUrl(), {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
  }
  return client;
}

/** Fixed-window counter in Redis (shared across app instances). */
export async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getClient();
  const windowKey = `central:ratelimit:${key}`;
  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.pexpire(windowKey, config.windowMs);
  }
  if (count > config.limit) {
    const ttl = await redis.pttl(windowKey);
    return {
      allowed: false,
      retryAfterMs: ttl > 0 ? ttl : config.windowMs
    };
  }
  return { allowed: true };
}

export function isDistributedRateLimitEnabled(): boolean {
  return isRedisQueueEnabled();
}

export async function closeRateLimitRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = undefined;
  }
}
