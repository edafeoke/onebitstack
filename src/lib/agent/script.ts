import type { Deployment, Environment, Project, Server } from "@/generated/prisma/client";
import { buildDeployTarget } from "@/lib/deploy/deploy-target";
import { prepareInfraApply } from "@/lib/deploy/build-infra-apply-script";
import { projectNeedsInfra } from "@/lib/deploy/infra";
import { interpolateDeployTemplates } from "@/lib/deploy/interpolate-templates";
import { persistentDatabaseUrl } from "@/lib/deploy/production-env";
import {
  appRootFromDeploymentPath,
  buildReleaseDeployCommand,
  currentSymlinkPath,
  projectSlugFromName,
  releaseDirForDeployment,
  sharedDirPath,
  sharedEnvPath
} from "@/lib/deploy/releases";
import { buildUsesNpm, npmBuildEnv } from "@/lib/deployment/normalize-commands";

type DeployContext = {
  deployment: Deployment;
  project: Project;
  environment: Environment;
  server: Server;
};

export function buildAgentReleaseScript(ctx: DeployContext): string | null {
  const { deployment, project, environment, server } = ctx;
  if (deployment.kind === "rollback" || deployment.kind === "config_only") {
    return null;
  }

  const appRoot = appRootFromDeploymentPath(project.deploymentPath, server.deployRoot);
  const releaseDir = releaseDirForDeployment(appRoot, deployment.id);
  const projectSlug = projectSlugFromName(project.name);

  const buildEnv: Record<string, string> = {};
  if (project.runtime === "node") {
    buildEnv.DATABASE_URL = persistentDatabaseUrl(projectSlug);
  }
  if (buildUsesNpm(project.buildCommand)) {
    Object.assign(buildEnv, npmBuildEnv());
  }

  const phase = deployment.kind === "full" ? "full" : "no_restart";

  return buildReleaseDeployCommand({
    appRoot,
    releaseDir,
    currentLink: currentSymlinkPath(appRoot),
    sharedDir: sharedDirPath(appRoot),
    sharedEnv: sharedEnvPath(appRoot),
    repository: project.repository,
    branch: environment.branch,
    buildCommand: project.buildCommand,
    framework: project.framework,
    runtime: project.runtime,
    projectSlug,
    envExports: Object.keys(buildEnv).length > 0 ? buildEnv : undefined,
    phase
  });
}

export function buildDeployTargetFromContext(ctx: DeployContext) {
  return buildDeployTarget(ctx.server, ctx.project.deploymentPath, {
    buildCommand: ctx.project.buildCommand,
    restartCommand: ctx.project.restartCommand
  });
}

/** Build + infra (+ optional restart) as one bash script for central-agent. */
export async function buildAgentFullDeployScript(
  ctx: DeployContext & { envVars?: import("@/generated/prisma/client").ProjectEnvVar[] }
): Promise<string | null> {
  const releaseScript = buildAgentReleaseScript(ctx);
  if (!releaseScript) return null;

  const { project, environment, server } = ctx;
  if (!projectNeedsInfra(project)) {
    return releaseScript;
  }

  const target = buildDeployTargetFromContext(ctx);
  const prepared = await prepareInfraApply({
    project: { ...project, server, envVars: ctx.envVars ?? [] },
    target,
    environmentSlug: environment.slug
  });

  const parts = [releaseScript];
  if (prepared) {
    parts.push(prepared.bashScript);
  }

  const usesPm2 =
    Boolean(project.pm2Config) &&
    (project.runtime === "node" || project.runtime === "python") &&
    project.port != null;

  if (project.restartCommand.trim() && !usesPm2) {
    const appRoot = appRootFromDeploymentPath(project.deploymentPath, server.deployRoot);
    const workTree = currentSymlinkPath(appRoot);
    const projectSlug = projectSlugFromName(project.name);
    const restart = interpolateDeployTemplates(
      project.restartCommand.trim(),
      project.repository,
      workTree,
      projectSlug
    );
    parts.push(`cd ${bashQ(workTree)} && ${restart}`);
  }

  return parts.join("\n");
}

function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

/** @deprecated Use buildAgentReleaseScript */
export const buildAgentDeployScript = buildAgentReleaseScript;
