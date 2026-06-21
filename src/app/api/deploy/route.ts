import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canDeploy, PERMISSION_DENIED_DEPLOY } from "@/lib/auth/permissions";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deployApiProjectRateLimit,
  deployApiUserRateLimit
} from "@/lib/rate-limit/config";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api-response";
import { appendDeploymentLogLine } from "@/lib/deploy";
import { enqueueDeployJob } from "@/lib/deploy-queue";

export const runtime = "nodejs";

const bodySchema = z.object({
  projectId: z.string().min(1),
  environmentSlug: z.string().optional(),
  kind: z.enum(["full", "config_only", "rollback"]).optional()
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slug = parsed.data.environmentSlug ?? "production";
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectsAccessibleWhere(session.user.id) },
    include: { environments: { where: { slug } } }
  });
  if (!project || project.environments.length === 0) {
    return apiError("Project or environment not found", 404, "NOT_FOUND");
  }

  if (!(await canDeploy(session.user.id, project.organizationId))) {
    return apiError(PERMISSION_DENIED_DEPLOY, 403, "FORBIDDEN");
  }

  const userLimit = await checkRateLimit(
    `deploy:user:${session.user.id}`,
    deployApiUserRateLimit()
  );
  if (!userLimit.allowed) {
    return apiError("Too many deploy requests. Try again shortly.", 429, "RATE_LIMITED");
  }

  const projectLimit = await checkRateLimit(
    `deploy:project:${project.id}`,
    deployApiProjectRateLimit()
  );
  if (!projectLimit.allowed) {
    return apiError("Too many deploys for this project. Try again shortly.", 429, "RATE_LIMITED");
  }

  const env = project.environments[0]!;
  const kind = parsed.data.kind ?? "full";
  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      environmentId: env.id,
      status: "queued",
      trigger: "manual",
      kind
    }
  });
  await appendDeploymentLogLine(
    deployment.id,
    kind === "config_only"
      ? "[manual] Queued config-only deploy from API"
      : "[manual] Queued from dashboard"
  );
  await enqueueDeployJob(deployment.id);

  return apiOk({ deploymentId: deployment.id });
}
