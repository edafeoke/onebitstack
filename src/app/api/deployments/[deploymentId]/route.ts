import { headers } from "next/headers";
import { apiError, apiOk } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { canPerformDestructiveOps } from "@/lib/auth/permissions";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ deploymentId: string }> }
): Promise<Response> {
  const { deploymentId } = await context.params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, project: projectsAccessibleWhere(session.user.id) },
    select: {
      status: true,
      kind: true,
      createdAt: true,
      environmentId: true,
      releasePath: true,
      assignedPort: true,
      project: { select: { id: true, name: true, repository: true, organizationId: true } }
    }
  });
  if (!deployment) {
    return apiError("Not found", 404, "NOT_FOUND");
  }

  const canDestructive = await canPerformDestructiveOps(
    session.user.id,
    deployment.project.organizationId
  );

  const previousRelease = await prisma.deployment.findFirst({
    where: {
      environmentId: deployment.environmentId,
      status: "success",
      releasePath: { not: null },
      createdAt: { lt: deployment.createdAt }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });

  return apiOk({
    status: deployment.status,
    kind: deployment.kind,
    createdAt: deployment.createdAt,
    projectId: deployment.project.id,
    projectName: deployment.project.name,
    repository: deployment.project.repository,
    releasePath: deployment.releasePath,
    assignedPort: deployment.assignedPort,
    canRollback: Boolean(previousRelease) && canDestructive,
    canDestructive
  });
}
