"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { appendDeploymentLogLine } from "@/lib/deploy";
import { endSshForDeployment } from "@/lib/active-ssh";

export async function cancelDeploymentAction(
  deploymentId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }

  const dep = await prisma.deployment.findFirst({
    where: { id: deploymentId, project: projectsAccessibleWhere(session.user.id) },
    select: { id: true, status: true }
  });
  if (!dep) {
    return { ok: false, message: "Deployment not found" };
  }

  if (dep.status === "success" || dep.status === "failed" || dep.status === "cancelled") {
    return { ok: false, message: "Deployment already finished" };
  }

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: "cancelled", finishedAt: new Date() }
  });

  endSshForDeployment(deploymentId);
  await appendDeploymentLogLine(deploymentId, "[deploy] Cancelled from dashboard.");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/deployments/${deploymentId}`);
  return { ok: true };
}
