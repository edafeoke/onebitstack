import { prisma } from "@/lib/prisma";
import type { PushDeployResult } from "@/lib/github/push-deploy";

export async function recordWebhookDeliveryOutcome(
  deliveryId: string,
  push?: PushDeployResult
): Promise<void> {
  if (!push) return;

  const primaryDeploymentId = push.deploymentIds[0] ?? null;
  let projectId: string | null = null;
  if (primaryDeploymentId) {
    const dep = await prisma.deployment.findUnique({
      where: { id: primaryDeploymentId },
      select: { projectId: true }
    });
    projectId = dep?.projectId ?? null;
  }

  await prisma.webhookDelivery.update({
    where: { deliveryId },
    data: {
      repository: push.repository ?? null,
      branch: push.branch ?? null,
      commitHash: push.commitHash ?? null,
      projectId,
      deploymentId: primaryDeploymentId,
      skipReason: push.matched ? null : (push.skipReason ?? "no_match")
    }
  });
}
