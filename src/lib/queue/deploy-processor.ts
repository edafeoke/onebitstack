import { DelayedError, type Job } from "bullmq";
import { runDeploymentJob } from "@/lib/deploy";
import type { DeployJobData } from "@/lib/queue/deploy-job";
import {
  releaseServerDeployLock,
  tryAcquireServerDeployLock
} from "@/lib/queue/deploy-lock";
import { createRedisConnection } from "@/lib/queue/redis";

let workerRedis: ReturnType<typeof createRedisConnection> | undefined;

function redisForWorker() {
  if (!workerRedis) {
    workerRedis = createRedisConnection();
  }
  return workerRedis;
}

export async function processDeployJob(
  job: Job<DeployJobData>,
  token?: string
): Promise<void> {
  const { deploymentId, serverId } = job.data;
  const lockToken = `${job.id ?? deploymentId}:${token ?? "0"}`;
  const redis = redisForWorker();

  const acquired = await tryAcquireServerDeployLock(redis, serverId, lockToken);
  if (!acquired) {
    await job.moveToDelayed(Date.now() + 5000, token);
    throw new DelayedError();
  }

  try {
    await runDeploymentJob(deploymentId);
  } finally {
    await releaseServerDeployLock(redis, serverId, lockToken);
  }
}

export async function closeDeployProcessorRedis(): Promise<void> {
  if (workerRedis) {
    await workerRedis.quit();
    workerRedis = undefined;
  }
}
