import { Queue } from "bullmq";
import { prisma } from "@/lib/prisma";
import { DEPLOY_QUEUE_NAME } from "@/lib/queue/constants";
import type { DeployJobData } from "@/lib/queue/deploy-job";
import { createRedisConnection } from "@/lib/queue/redis";

let queue: Queue<DeployJobData> | undefined;
let queueConnection: ReturnType<typeof createRedisConnection> | undefined;

function getQueue(): Queue<DeployJobData> {
  if (!queue) {
    queueConnection = createRedisConnection();
    queue = new Queue<DeployJobData>(DEPLOY_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 }
      }
    });
  }
  return queue;
}

export async function enqueueBullDeployJob(deploymentId: string): Promise<void> {
  const row = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    select: { project: { select: { serverId: true } } }
  });
  if (!row) return;

  const serverId = row.project.serverId;
  await getQueue().add(
    "run",
    { deploymentId, serverId },
    {
      jobId: deploymentId,
      removeOnComplete: true,
      removeOnFail: false
    }
  );
}

export async function closeBullDeployQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
  if (queueConnection) {
    await queueConnection.quit();
    queueConnection = undefined;
  }
}
