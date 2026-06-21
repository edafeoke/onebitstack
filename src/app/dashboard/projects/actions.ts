"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  canPerformDestructiveOps,
  canWriteProject,
  PERMISSION_DENIED_DESTRUCTIVE
} from "@/lib/auth/permissions";
import {
  installationsAccessibleWhere,
  projectsAccessibleWhere,
  serversAccessibleWhere
} from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { appendDeploymentLogLine } from "@/lib/deploy";
import { endSshForDeployment } from "@/lib/active-ssh";
import {
  allocateNextAppPort,
  projectNeedsAppPort,
  validateProjectPort
} from "@/lib/port-allocation";
import { buildDeployTarget } from "@/lib/deploy/deploy-target";
import { teardownProjectOnServer } from "@/lib/deploy/teardown";
import {
  assertHostnamesAvailableOnServer,
  syncPrimaryProjectDomain
} from "@/lib/nginx/domains";

const createProjectSchema = z.object({
  name: z.string().min(1),
  serverId: z.string().min(1),
  repository: z.string().min(1),
  branch: z.string().min(1),
  deploymentPath: z.string().min(1),
  installationId: z.string().optional(),
  githubInstallationId: z.string().optional(),
  framework: z.string().optional(),
  runtime: z.string().optional(),
  domain: z.string().optional(),
  webServer: z.enum(["nginx", "apache"]).optional(),
  port: z.number().int().positive().max(65535).optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  restartCommand: z.string().optional()
});

export async function createProjectAction(
  input: unknown
): Promise<{ ok: true; projectId: string } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.serverId, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) {
    return { ok: false, message: "Server not found" };
  }
  if (!(await canWriteProject(session.user.id, server.organizationId))) {
    return { ok: false, message: "You do not have permission to create projects in this workspace." };
  }

  if (parsed.data.installationId?.trim()) {
    const inst = await prisma.gitHubAppInstallation.findFirst({
      where: {
        installationId: parsed.data.installationId.trim(),
        suspended: false,
        ...installationsAccessibleWhere(session.user.id)
      }
    });
    if (!inst) {
      return { ok: false, message: "GitHub installation not available in your workspace." };
    }
  }

  const framework = parsed.data.framework?.trim() || null;
  const runtime = parsed.data.runtime?.trim() || null;
  const needsPort = projectNeedsAppPort(framework, runtime);

  const remoteTarget = buildDeployTarget(server, parsed.data.deploymentPath.trim());

  let port: number | null | undefined = parsed.data.port;
  if (needsPort) {
    if (port == null) {
      try {
        port = await allocateNextAppPort(server.id, { remoteTarget });
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    } else {
      const portCheck = await validateProjectPort({
        serverId: server.id,
        port,
        remoteTarget
      });
      if (!portCheck.ok) return { ok: false, message: portCheck.message };
    }
  } else {
    port = port ?? null;
  }

  const domainRaw = parsed.data.domain?.trim() || null;
  if (domainRaw) {
    const hostCheck = await assertHostnamesAvailableOnServer({
      serverId: server.id,
      hostnames: [domainRaw]
    });
    if (!hostCheck.ok) return { ok: false, message: hostCheck.message };
  }

  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      organizationId: server.organizationId,
      serverId: server.id,
      githubInstallationId: parsed.data.githubInstallationId?.trim() || null,
      name: parsed.data.name,
      repository: parsed.data.repository.trim(),
      branch: parsed.data.branch.trim(),
      deploymentPath: parsed.data.deploymentPath.trim(),
      framework,
      runtime,
      domain: domainRaw,
      webServer: parsed.data.webServer ?? null,
      port,
      buildCommand: parsed.data.buildCommand?.trim() ?? "",
      startCommand: parsed.data.startCommand?.trim() ?? "",
      restartCommand: parsed.data.restartCommand?.trim() ?? ""
    }
  });

  if (domainRaw) {
    await syncPrimaryProjectDomain({
      projectId: project.id,
      serverId: server.id,
      hostname: domainRaw
    });
  }

  await prisma.environment.create({
    data: {
      projectId: project.id,
      name: "Production",
      slug: "production",
      branch: parsed.data.branch.trim()
    }
  });

  revalidatePath("/dashboard/projects");
  return { ok: true, projectId: project.id };
}

const deleteProjectSchema = z.object({
  id: z.string().min(1),
  confirmName: z.string().min(1)
});

export async function deleteProjectAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string; details?: string[] }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  const parsed = deleteProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.id, ...projectsAccessibleWhere(session.user.id) },
    include: { server: true }
  });
  if (!project) {
    return { ok: false, message: "Project not found" };
  }
  if (parsed.data.confirmName.trim() !== project.name) {
    return { ok: false, message: "Project name does not match. Type the exact name to confirm." };
  }
  if (!(await canPerformDestructiveOps(session.user.id, project.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  const running = await prisma.deployment.findMany({
    where: { projectId: project.id, status: "running" },
    select: { id: true }
  });
  for (const { id: depId } of running) {
    endSshForDeployment(depId);
    await prisma.deployment.update({
      where: { id: depId },
      data: { status: "cancelled", finishedAt: new Date() }
    });
    await appendDeploymentLogLine(depId, "[deploy] Cancelled (project deleted).");
  }

  await prisma.deployment.updateMany({
    where: { projectId: project.id, status: "queued" },
    data: { status: "cancelled", finishedAt: new Date() }
  });

  const target = buildDeployTarget(project.server, project.deploymentPath);
  const teardown = await teardownProjectOnServer({ project, target });
  if (!teardown.ok) {
    return {
      ok: false,
      message: `Server cleanup failed: ${teardown.message}`,
      details: teardown.lines
    };
  }

  await prisma.project.delete({ where: { id: project.id } });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${project.id}`);
  return { ok: true };
}
