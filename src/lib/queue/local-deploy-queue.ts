import PQueue from "p-queue";
import { prisma } from "@/lib/prisma";
import { runDeploymentJob } from "@/lib/deploy";

const queuesByServer = new Map<string, PQueue>();

function queueForServer(serverId: string): PQueue {
  let q = queuesByServer.get(serverId);
  if (!q) {
    q = new PQueue({ concurrency: 1 });
    queuesByServer.set(serverId, q);
  }
  return q;
}

/** In-process queue when REDIS_URL is unset (local dev without Redis). */
export function enqueueLocalDeployJob(deploymentId: string): void {
  void (async () => {
    const row = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { project: { select: { serverId: true } } }
    });
    if (!row) return;
    const serverId = row.project.serverId;
    void queueForServer(serverId).add(async () => {
      await runDeploymentJob(deploymentId);
    });
  })();
}
