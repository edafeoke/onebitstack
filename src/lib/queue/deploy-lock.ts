import type IORedis from "ioredis";
import { DEPLOY_LOCK_KEY_PREFIX, DEPLOY_LOCK_TTL_MS } from "@/lib/queue/constants";

export function serverDeployLockKey(serverId: string): string {
  return `${DEPLOY_LOCK_KEY_PREFIX}${serverId}`;
}

/** Acquire exclusive deploy slot for a server (one deployment at a time per VPS). */
export async function tryAcquireServerDeployLock(
  redis: IORedis,
  serverId: string,
  token: string
): Promise<boolean> {
  const result = await redis.set(
    serverDeployLockKey(serverId),
    token,
    "PX",
    DEPLOY_LOCK_TTL_MS,
    "NX"
  );
  return result === "OK";
}

/** Release lock only if we still own it. */
export async function releaseServerDeployLock(
  redis: IORedis,
  serverId: string,
  token: string
): Promise<void> {
  const key = serverDeployLockKey(serverId);
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, key, token);
}
