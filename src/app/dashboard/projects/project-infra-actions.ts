"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  canPerformDestructiveOps,
  PERMISSION_DENIED_DESTRUCTIVE
} from "@/lib/auth/permissions";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { appendDeploymentLogLine } from "@/lib/deploy";
import { enqueueDeployJob } from "@/lib/deploy-queue";
import { ensureGeneratedConfigs } from "@/lib/deploy/apply-infra";
import { isPhpFpmStack } from "@/lib/deployment/templates/nginx";
import { isStaticStack } from "@/lib/deployment/templates/nginx-common";
import { validateGithubBranchExists } from "@/lib/github/validate-branch";
import { buildDeployTarget } from "@/lib/deploy/deploy-target";
import { serializeEnvVarForDb, type EnvVarInput } from "@/lib/project-env";
import {
  ensureProjectPort,
  projectNeedsAppPort,
  validateProjectPort
} from "@/lib/port-allocation";
import {
  assertHostnamesAvailableOnServer,
  syncPrimaryProjectDomain
} from "@/lib/nginx/domains";

import {
  replaceEnvVarsSchema,
  updateBranchSchema
} from "@/lib/schemas/project";

const updateInfraSchema = z.object({
  projectId: z.string().min(1),
  framework: z.string().optional(),
  runtime: z.string().optional(),
  domain: z.string().optional(),
  webServer: z.enum(["nginx", "apache"]).optional().nullable(),
  port: z.union([z.number().int().positive().max(65535), z.null()]).optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  restartCommand: z.string().optional(),
  nginxConfig: z.string().optional().nullable(),
  apacheConfig: z.string().optional().nullable(),
  pm2Config: z.string().optional().nullable()
});

export async function updateProjectInfraAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = updateInfraSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const p = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectsAccessibleWhere(session.user.id) },
    include: { server: true }
  });
  if (!p) return { ok: false, message: "Project not found" };

  const framework =
    parsed.data.framework !== undefined ? parsed.data.framework.trim() || null : p.framework;
  const runtime =
    parsed.data.runtime !== undefined ? parsed.data.runtime.trim() || null : p.runtime;
  const remoteTarget = buildDeployTarget(p.server, p.deploymentPath);

  let resolvedPort: number | null | undefined;
  if (projectNeedsAppPort(framework, runtime)) {
    resolvedPort = await ensureProjectPort({
      projectId: p.id,
      serverId: p.serverId,
      framework,
      runtime,
      remoteTarget
    });
  } else if (parsed.data.port !== undefined) {
    resolvedPort = parsed.data.port;
  }

  if (parsed.data.port != null && parsed.data.port !== resolvedPort) {
    const portCheck = await validateProjectPort({
      serverId: p.serverId,
      port: parsed.data.port,
      projectId: p.id,
      remoteTarget
    });
    if (!portCheck.ok) return { ok: false, message: portCheck.message };
    resolvedPort = parsed.data.port;
  }

  const domain =
    parsed.data.domain !== undefined ? parsed.data.domain.trim() || null : p.domain;
  if (parsed.data.domain !== undefined && domain) {
    const hostCheck = await assertHostnamesAvailableOnServer({
      serverId: p.serverId,
      hostnames: [domain],
      excludeProjectId: p.id
    });
    if (!hostCheck.ok) return { ok: false, message: hostCheck.message };
  }

  await prisma.project.update({
    where: { id: p.id },
    data: {
      framework,
      runtime,
      domain,
      webServer: parsed.data.webServer ?? null,
      ...(resolvedPort !== undefined ? { port: resolvedPort } : {}),
      buildCommand: parsed.data.buildCommand?.trim() ?? p.buildCommand,
      startCommand: parsed.data.startCommand?.trim() ?? p.startCommand,
      restartCommand: parsed.data.restartCommand?.trim() ?? p.restartCommand,
      nginxConfig: parsed.data.nginxConfig ?? undefined,
      apacheConfig: parsed.data.apacheConfig ?? undefined,
      pm2Config: parsed.data.pm2Config ?? undefined
    }
  });
  if (parsed.data.domain !== undefined) {
    await syncPrimaryProjectDomain({
      projectId: p.id,
      serverId: p.serverId,
      hostname: domain
    });
  }
  revalidatePath(`/dashboard/projects/${p.id}`);
  return { ok: true };
}

const regenerateSchema = z.object({
  projectId: z.string().min(1),
  /** Use current Deploy tab values so regenerate works before a separate Save. */
  port: z.union([z.number().int().positive().max(65535), z.null()]).optional(),
  webServer: z.enum(["nginx", "apache"]).optional().nullable(),
  domain: z.string().optional(),
  runtime: z.string().optional(),
  framework: z.string().optional()
});

export async function regenerateProjectConfigsAction(
  input: unknown
): Promise<
  | {
      ok: true;
      nginxConfig: string | null;
      apacheConfig: string | null;
      pm2Config: string | null;
    }
  | { ok: false; message: string }
> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = regenerateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const row = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectsAccessibleWhere(session.user.id) },
    include: { server: true, envVars: true, domains: true }
  });
  if (!row) return { ok: false, message: "Project not found" };

  const port = parsed.data.port !== undefined ? parsed.data.port : row.port;
  const webServer =
    parsed.data.webServer !== undefined ? parsed.data.webServer : row.webServer;
  const domain =
    parsed.data.domain !== undefined ? parsed.data.domain.trim() || null : row.domain;
  const runtime =
    parsed.data.runtime !== undefined ? parsed.data.runtime.trim() || null : row.runtime;
  const framework =
    parsed.data.framework !== undefined ? parsed.data.framework.trim() || null : row.framework;

  if (parsed.data.domain !== undefined && domain) {
    const hostCheck = await assertHostnamesAvailableOnServer({
      serverId: row.serverId,
      hostnames: [domain],
      excludeProjectId: row.id
    });
    if (!hostCheck.ok) return { ok: false, message: hostCheck.message };
  }

  const needsPort = projectNeedsAppPort(framework, runtime);
  let resolvedPort = port;
  if (needsPort && resolvedPort == null) {
    resolvedPort = await ensureProjectPort({
      projectId: row.id,
      serverId: row.serverId,
      framework,
      runtime,
      remoteTarget: buildDeployTarget(row.server, row.deploymentPath)
    });
  }

  if (resolvedPort == null && needsPort) {
    return {
      ok: false,
      message: "Could not allocate an app port on this server. Check for free ports in range 3001–3999."
    };
  }
  if (webServer !== "nginx" && webServer !== "apache") {
    return {
      ok: false,
      message: 'Set Web server to "nginx" or "apache" on the Deploy tab, then regenerate.'
    };
  }

  await prisma.project.update({
    where: { id: row.id },
    data: {
      port: resolvedPort ?? row.port,
      webServer,
      domain,
      runtime,
      framework,
      nginxConfig: null,
      apacheConfig: null,
      pm2Config: null
    }
  });
  if (parsed.data.domain !== undefined) {
    await syncPrimaryProjectDomain({
      projectId: row.id,
      serverId: row.serverId,
      hostname: domain
    });
  }
  const fresh = await prisma.project.findUniqueOrThrow({
    where: { id: row.id },
    include: { server: true, envVars: true }
  });
  const updated = await ensureGeneratedConfigs(fresh);

  const generated: string[] = [];
  if (updated.nginxConfig) generated.push("nginx");
  if (updated.apacheConfig) generated.push("apache");
  if (updated.pm2Config) generated.push("pm2");
  if (generated.length === 0) {
    const phpStack = isPhpFpmStack(framework, runtime);
    const staticStack = isStaticStack(framework, runtime);
    return {
      ok: false,
      message:
        webServer === "nginx"
          ? phpStack || staticStack
            ? "Nothing generated. Set Web server to nginx and a domain (optional), then try again."
            : "Nothing generated. Check port and web server, then try again."
          : "Nothing generated. For PM2, set Runtime to node on the Deploy tab."
    };
  }

  revalidatePath(`/dashboard/projects/${row.id}`);
  return {
    ok: true,
    nginxConfig: updated.nginxConfig,
    apacheConfig: updated.apacheConfig,
    pm2Config: updated.pm2Config
  };
}

const idSchema = z.object({ projectId: z.string().min(1) });

export async function queueConfigOnlyDeployAction(
  input: unknown
): Promise<{ ok: true; deploymentId: string } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectsAccessibleWhere(session.user.id) },
    include: { environments: { where: { slug: "production" } } }
  });
  if (!project) return { ok: false, message: "Project not found" };
  const env = project.environments[0];
  if (!env) return { ok: false, message: "Environment not found" };
  const deployment = await prisma.deployment.create({
    data: {
      projectId: project.id,
      environmentId: env.id,
      status: "queued",
      trigger: "manual",
      kind: "config_only"
    }
  });
  await appendDeploymentLogLine(deployment.id, "[manual] Queued config-only deploy");
  await enqueueDeployJob(deployment.id);
  revalidatePath(`/dashboard/projects/${project.id}`);
  return { ok: true, deploymentId: deployment.id };
}

export async function updateEnvironmentBranchAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = updateBranchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectsAccessibleWhere(session.user.id) },
    select: {
      id: true,
      repository: true,
      githubInstallationId: true
    }
  });
  if (!project) return { ok: false, message: "Project not found" };

  const env = await prisma.environment.findFirst({
    where: { id: parsed.data.environmentId, projectId: project.id }
  });
  if (!env) return { ok: false, message: "Environment not found" };

  const branch = parsed.data.branch.trim();
  if (project.githubInstallationId) {
    const check = await validateGithubBranchExists({
      installationId: project.githubInstallationId,
      repository: project.repository,
      branch
    });
    if (!check.ok) return { ok: false, message: check.message };
  }

  await prisma.$transaction([
    prisma.environment.update({
      where: { id: env.id },
      data: { branch }
    }),
    prisma.project.update({
      where: { id: project.id },
      data: { branch }
    })
  ]);

  revalidatePath(`/dashboard/projects/${project.id}`);
  return { ok: true };
}

export async function replaceProjectEnvVarsAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = replaceEnvVarsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const scopedKeys = parsed.data.envVars.map((r) => `${r.scope}:${r.key.trim()}`);
  if (new Set(scopedKeys).size !== scopedKeys.length) {
    return { ok: false, message: "Duplicate keys in the same scope are not allowed." };
  }
  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, ...projectsAccessibleWhere(session.user.id) }
  });
  if (!project) return { ok: false, message: "Project not found" };

  const existing = await prisma.projectEnvVar.findMany({
    where: { projectId: project.id }
  });
  const existingByKey = new Map(
    existing.map((e) => [`${e.scope}:${e.key}`, e] as const)
  );

  await prisma.$transaction(async (tx) => {
    await tx.projectEnvVar.deleteMany({ where: { projectId: project.id } });
    if (parsed.data.envVars.length > 0) {
      const data = parsed.data.envVars.map((r) => {
        const row: EnvVarInput = {
          key: r.key.trim(),
          scope: r.scope,
          isSecret: r.isSecret,
          value: r.value
        };
        if (
          row.isSecret &&
          !row.value &&
          r.hasSecret &&
          existingByKey.has(`${row.scope}:${row.key}`)
        ) {
          const prev = existingByKey.get(`${row.scope}:${row.key}`)!;
          return {
            projectId: project.id,
            key: row.key,
            scope: row.scope,
            isSecret: true,
            value: "",
            valueCipher: prev.valueCipher,
            valueIv: prev.valueIv,
            valueTag: prev.valueTag
          };
        }
        return { projectId: project.id, ...serializeEnvVarForDb(row) };
      });
      await tx.projectEnvVar.createMany({ data });
    }
  });

  revalidatePath(`/dashboard/projects/${project.id}`);
  return { ok: true };
}

const rollbackSchema = z.object({
  deploymentId: z.string().min(1)
});

/** Roll back to the previous successful release for this deployment's environment. */
export async function rollbackDeploymentAction(
  input: unknown
): Promise<{ ok: true; deploymentId: string } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = rollbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const from = await prisma.deployment.findFirst({
    where: { id: parsed.data.deploymentId, project: { ...projectsAccessibleWhere(session.user.id) } },
    include: { environment: true, project: true }
  });
  if (!from) return { ok: false, message: "Deployment not found" };
  if (!(await canPerformDestructiveOps(session.user.id, from.project.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  const previous = await prisma.deployment.findFirst({
    where: {
      environmentId: from.environmentId,
      status: "success",
      releasePath: { not: null },
      createdAt: { lt: from.createdAt }
    },
    orderBy: { createdAt: "desc" }
  });
  if (!previous?.releasePath) {
    return { ok: false, message: "No earlier successful release to roll back to." };
  }

  const deployment = await prisma.deployment.create({
    data: {
      projectId: from.projectId,
      environmentId: from.environmentId,
      status: "queued",
      trigger: "manual",
      kind: "rollback",
      parentDeploymentId: previous.id,
      releasePath: previous.releasePath,
      assignedPort: from.project.port
    }
  });
  await appendDeploymentLogLine(
    deployment.id,
    `[rollback] Queued rollback to deployment ${previous.id}`
  );
  await enqueueDeployJob(deployment.id);
  revalidatePath(`/dashboard/projects/${from.projectId}`);
  revalidatePath(`/dashboard/deployments/${deployment.id}`);
  return { ok: true, deploymentId: deployment.id };
}
