import {
  checkRateLimit as checkRateLimitMemory,
  type RateLimitConfig,
  type RateLimitResult
} from "@/lib/rate-limit/memory";
import { checkRateLimitRedis, isDistributedRateLimitEnabled } from "@/lib/rate-limit/redis";

export type { RateLimitConfig, RateLimitResult } from "@/lib/rate-limit/memory";
export { resetRateLimitBucketsForTests } from "@/lib/rate-limit/memory";

/**
 * Rate limit check — uses Redis when REDIS_URL is set (multi-instance safe), else in-memory.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (isDistributedRateLimitEnabled()) {
    return checkRateLimitRedis(key, config);
  }
  return checkRateLimitMemory(key, config);
}
