import type { Project, ProjectEnvVar, Server } from "@/generated/prisma/client";
import type { DeployTarget } from "@/lib/deploy/types";
import { bashQ, bashWriteFile } from "@/lib/deploy/bash-heredoc";
import {
  buildLaravelDatabaseScript,
  buildLaravelStorageSymlinkScript,
  ensureGeneratedConfigs
} from "@/lib/deploy/apply-infra";
import {
  formatEnvFile,
  persistentDatabasePath,
  productionPhpEnv,
  productionRuntimeEnv
} from "@/lib/deploy/production-env";
import { isPhpFpmStack } from "@/lib/deployment/templates/nginx";
import { isStaticStack } from "@/lib/deployment/templates/nginx-common";
import {
  assertHostnamesAvailableOnServer,
  hostnamesFromProject,
  syncPrimaryProjectDomain
} from "@/lib/nginx/domains";
import {
  buildNginxHostnamePreflightScript,
  buildNginxSiteInstallScript,
  nginxInstallPaths
} from "@/lib/nginx/install";
import { extractServerNamesFromNginxConfig } from "@/lib/nginx/server-names";
import { RUN_ROOT_HELPER } from "@/lib/deploy/remote-shell";
import { projectLogsDir, serverLayoutFromRoot } from "@/lib/server-layout";
import { slugify } from "@/lib/deploy/slug";
import {
  appRootFromDeploymentPath,
  currentSymlinkPath,
  sharedDirPath,
  sharedEnvPath,
  sharedStoragePath
} from "@/lib/deploy/releases";

export type InfraApplyPrepared = {
  bashScript: string;
};

export async function prepareInfraApply(input: {
  project: Project & { server: Server; envVars: ProjectEnvVar[] };
  target: DeployTarget;
  environmentSlug?: string;
}): Promise<InfraApplyPrepared | null> {
  const { project, target, environmentSlug = "production" } = input;
  const phpStack = isPhpFpmStack(project.framework, project.runtime);
  const staticStack = isStaticStack(project.framework, project.runtime);

  if (!project.webServer) return null;
  if (!project.port && !phpStack && !staticStack) return null;

  const slug = slugify(project.name);
  const layout = serverLayoutFromRoot(target.deployRoot);
  const logDir = projectLogsDir(slug, target.deployRoot);
  const proj = await ensureGeneratedConfigs(project);
  const web = proj.webServer;
  const lines: string[] = ["set -e", RUN_ROOT_HELPER];

  lines.push(
    `mkdir -p ${bashQ(layout.configsNginx)} ${bashQ(layout.configsApache)} ${bashQ(layout.configsPm2)} ${bashQ(logDir)}`
  );

  if (web === "nginx" && proj.nginxConfig) {
    const paths = nginxInstallPaths(slug, layout.configsNginx);
    const configHostnames = extractServerNamesFromNginxConfig(proj.nginxConfig);
    const claimed = hostnamesFromProject({
      domain: proj.domain,
      domains: configHostnames.map((hostname) => ({ hostname, isPrimary: false }))
    });
    const hostCheck = await assertHostnamesAvailableOnServer({
      serverId: proj.serverId,
      hostnames: claimed.length > 0 ? claimed : configHostnames,
      excludeProjectId: proj.id
    });
    if (!hostCheck.ok) {
      throw new Error(hostCheck.message);
    }

    if (proj.domain?.trim() && !proj.domain.endsWith(".local")) {
      await syncPrimaryProjectDomain({
        projectId: proj.id,
        serverId: proj.serverId,
        hostname: proj.domain
      });
    }

    const publicHosts = configHostnames.filter((h) => !h.endsWith(".local"));
    if (publicHosts.length > 0) {
      lines.push(buildNginxHostnamePreflightScript({ slug, hostnames: publicHosts }));
    }

    lines.push(bashWriteFile(paths.configDropPath, proj.nginxConfig));
    lines.push(buildNginxSiteInstallScript(paths));
    lines.push('echo "[infra] nginx reloaded"');
  }

  if (web === "apache" && proj.apacheConfig) {
    const remoteDrop = `${layout.configsApache}/${slug}.conf`;
    const siteAvail = `/etc/apache2/sites-available/${slug}.conf`;
    const bak = `${siteAvail}.bak.central`;
    lines.push(bashWriteFile(remoteDrop, proj.apacheConfig));
    lines.push(
      [
        `DROP=${bashQ(remoteDrop)}`,
        `SITE=${bashQ(siteAvail)}`,
        `BAK=${bashQ(bak)}`,
        `if run_root test -f "$SITE"; then run_root cp "$SITE" "$BAK"; fi`,
        `run_root cp "$DROP" "$SITE"`,
        `run_root a2ensite ${slug}.conf || true`,
        `if ! run_root apachectl configtest; then`,
        `  if run_root test -f "$BAK"; then run_root cp "$BAK" "$SITE"; else run_root rm -f "$SITE"; fi`,
        `  exit 1`,
        `fi`,
        `run_root systemctl reload apache2`,
        'echo "[infra] apache reloaded"'
      ].join("\n")
    );
  }

  const appRoot = appRootFromDeploymentPath(project.deploymentPath, target.deployRoot);
  const wd = currentSymlinkPath(appRoot);
  const sharedEnv = sharedEnvPath(appRoot);
  const usesPm2 =
    Boolean(proj.pm2Config) &&
    (proj.runtime === "node" || proj.runtime === "python") &&
    proj.port != null;

  if (phpStack || usesPm2) {
    const runtimeEnv = usesPm2
      ? productionRuntimeEnv(project, proj.port!, environmentSlug, target.deployRoot)
      : productionPhpEnv(project, environmentSlug, target.deployRoot);
    const dataDir = persistentDatabasePath(slug, target.deployRoot).replace(/\/[^/]+$/, "");
    lines.push(
      `mkdir -p ${bashQ(dataDir)} ${bashQ(sharedDirPath(appRoot))} ${bashQ(sharedStoragePath(appRoot))} ${bashQ(logDir)}`
    );
    lines.push(bashWriteFile(sharedEnv, formatEnvFile(runtimeEnv)));
    lines.push(`ln -sf ${bashQ(sharedEnv)} ${bashQ(`${wd}/.env`)}`);
    lines.push('echo "[infra] shared/.env written"');
    if (phpStack) {
      lines.push(buildLaravelStorageSymlinkScript(appRoot));
      lines.push(buildLaravelDatabaseScript(appRoot, slug, target.deployRoot));
    }
  }

  if (usesPm2 && proj.pm2Config) {
    const pmPath = `${layout.configsPm2}/${slug}.config.cjs`;
    lines.push(bashWriteFile(pmPath, proj.pm2Config));
    lines.push(
      [
        "sleep 3",
        `cd ${bashQ(wd)}`,
        `pm2 startOrReload ${bashQ(pmPath)} --only ${bashQ(slug)} --update-env`,
        "pm2 save",
        'echo "[infra] pm2 reloaded"'
      ].join("\n")
    );
  }

  return { bashScript: lines.join("\n") };
}
