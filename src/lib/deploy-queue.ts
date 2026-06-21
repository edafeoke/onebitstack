import { assertDeployQueueAvailable } from "@/lib/production/config";
import { enqueueBullDeployJob } from "@/lib/queue/bull-deploy-queue";
import { enqueueLocalDeployJob } from "@/lib/queue/local-deploy-queue";
import { isRedisQueueEnabled } from "@/lib/queue/redis";
import { prisma } from "@/lib/prisma";

/**
 * Queue a deployment for background execution.
 * Uses BullMQ + Redis when REDIS_URL is set; otherwise falls back to in-process p-queue (dev only).
 */
export async function enqueueDeployJob(deploymentId: string): Promise<void> {
  const queueCheck = assertDeployQueueAvailable();
  if (!queueCheck.ok) {
    console.error(`[deploy-queue] ${queueCheck.message}`);
    await prisma.deployment.updateMany({
      where: { id: deploymentId, status: "queued" },
      data: { status: "failed", finishedAt: new Date() }
    });
    return;
  }

  if (isRedisQueueEnabled()) {
    await enqueueBullDeployJob(deploymentId).catch((err) => {
      console.error("[deploy-queue] Failed to enqueue BullMQ job:", err);
    });
    return;
  }
  enqueueLocalDeployJob(deploymentId);
}

export { isRedisQueueEnabled } from "@/lib/queue/redis";
