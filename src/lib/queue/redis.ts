import IORedis from "ioredis";

export function isRedisQueueEnabled(): boolean {
  const url = process.env.REDIS_URL?.trim();
  return Boolean(url);
}

export function resolveRedisUrl(): string {
  return process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";
}

/** BullMQ requires `maxRetriesPerRequest: null` on blocking connections. */
export function createRedisConnection(): IORedis {
  return new IORedis(resolveRedisUrl(), {
    maxRetriesPerRequest: null
  });
}
