import { prisma } from "@/lib/prisma";
import type { Project, ProjectEnvVar, Server } from "@/generated/prisma/client";
import type { DeployStreamHandlers } from "@/lib/deploy/types";
import type { DeployTarget } from "@/lib/deploy/types";
import { bashQ } from "@/lib/deploy/bash-heredoc";
import { prepareInfraApply } from "@/lib/deploy/build-infra-apply-script";
import { withSshSession } from "@/lib/deploy/ssh-session";
import { appendDeploymentLogLine } from "@/lib/deploy/deployment-log";
import { persistentDatabasePath, productionPhpEnv, productionRuntimeEnv } from "@/lib/deploy/production-env";
import { projectLogsDir } from "@/lib/server-layout";
import { slugify } from "@/lib/deploy/slug";
import { buildEnsurePhpSqliteExtensionScript } from "@/lib/deploy/php-sqlite";
import { normalizeStartCommand, pm2LaunchFromStartCommand } from "@/lib/deployment/normalize-commands";
import { generateNginxConfig, isPhpFpmStack } from "@/lib/deployment/templates/nginx";
import { isStaticStack } from "@/lib/deployment/templates/nginx-common";
import { RUN_ROOT_HELPER, SUDO_HINT } from "@/lib/deploy/remote-shell";
import { generateApacheConfig } from "@/lib/deployment/templates/apache";
import { generatePM2Config } from "@/lib/deployment/templates/pm2";
import {
  appRootFromDeploymentPath,
  currentSymlinkPath,
  sharedStoragePath
} from "@/lib/deploy/releases";

function substitutePort(cmd: string, port: number): string {
  return cmd.replaceAll("${PORT}", String(port));
}

/** Writable dirs under shared storage (survives release cutover). */
const LARAVEL_STORAGE_SUBDIRS = [
  "app/public",
  "framework/cache/data",
  "framework/sessions",
  "framework/views",
  "framework/testing",
  "logs"
] as const;

const LARAVEL_WEB_USER = "www-data";

/**
 * Point release storage at shared/storage and ensure PHP-FPM can write views/cache/logs.
 * Without www-data ownership, tempnam() falls back to /tmp and PHP 8.4 raises on Blade compile.
 */
export function buildLaravelStorageSymlinkScript(appRoot: string): string {
  const current = currentSymlinkPath(appRoot);
  const sharedStorage = sharedStoragePath(appRoot);
  const mkdirLine = LARAVEL_STORAGE_SUBDIRS.map((d) => `"$SHARED/${d}"`).join(" ");

  return [
    "set -e",
    RUN_ROOT_HELPER,
    `CURRENT=${bashQ(current)}`,
    `SHARED=${bashQ(sharedStorage)}`,
    `WEB_USER=${LARAVEL_WEB_USER}`,
    `mkdir -p ${mkdirLine}`,
    `rm -rf "$CURRENT/storage"`,
    `ln -sfn "$SHARED" "$CURRENT/storage"`,
    `mkdir -p "$CURRENT/bootstrap/cache"`,
    `if id "$WEB_USER" >/dev/null 2>&1; then`,
    `  run_root chown -R "$WEB_USER:$WEB_USER" "$SHARED" "$CURRENT/bootstrap/cache"`,
    `  run_root chmod -R ug+rwx "$SHARED" "$CURRENT/bootstrap/cache"`,
    `fi`,
    `mkdir -p "$SHARED/app/public"`,
    `rm -f "$CURRENT/public/storage"`,
    `ln -sfn ../storage/app/public "$CURRENT/public/storage"`
  ].join("\n");
}

/** Create persistent SQLite file and run migrations (database session driver). */
export function buildLaravelDatabaseScript(
  appRoot: string,
  slug: string,
  deployRoot?: string | null
): string {
  const current = currentSymlinkPath(appRoot);
  const dbFile = persistentDatabasePath(slug, deployRoot);
  const dataDir = dbFile.replace(/\/[^/]+$/, "");

  return [
    buildEnsurePhpSqliteExtensionScript(),
    "set -e",
    RUN_ROOT_HELPER,
    `CURRENT=${bashQ(current)}`,
    `DB_FILE=${bashQ(dbFile)}`,
    `DATA_DIR=${bashQ(dataDir)}`,
    `WEB_USER=${LARAVEL_WEB_USER}`,
    `mkdir -p "$DATA_DIR"`,
    `if [ ! -f "$DB_FILE" ]; then touch "$DB_FILE"; fi`,
    `if id "$WEB_USER" >/dev/null 2>&1; then`,
    `  run_root chown -R "$WEB_USER:$WEB_USER" "$DATA_DIR"`,
    `  run_root chmod ug+rwx "$DATA_DIR"`,
    `  run_root chmod ug+rw "$DB_FILE"`,
    `fi`,
    `cd "$CURRENT"`,
    `if [ -f artisan ]; then`,
    `  if id "$WEB_USER" >/dev/null 2>&1; then`,
    `    sudo -n -u "$WEB_USER" php artisan migrate --force`,
    `  else`,
    `    php artisan migrate --force`,
    `  fi`,
    `fi`
  ].join("\n");
}

export async function ensureGeneratedConfigs(
  project: Project & {
    server: Server;
    envVars: ProjectEnvVar[];
    domains?: { hostname: string; isPrimary: boolean }[];
  }
): Promise<Project & { server: Server; envVars: ProjectEnvVar[] }> {
  const port = project.port;
  const phpStack = isPhpFpmStack(project.framework, project.runtime);
  const staticStack = isStaticStack(project.framework, project.runtime);
  if (port == null && !phpStack && !staticStack) return project;

  const slug = slugify(project.name);
  const deployRoot = project.server.deployRoot;
  const primaryDomain =
    project.domains?.find((d) => d.isPrimary)?.hostname ??
    project.domains?.[0]?.hostname ??
    project.domain?.trim();
  const serverName = primaryDomain?.trim() || `${slug}.local`;
  const mapSuffix = project.id.replace(/-/g, "").slice(0, 12);
  const logDir = projectLogsDir(slug, deployRoot);

  let nginxConfig = project.nginxConfig;
  let apacheConfig = project.apacheConfig;
  let pm2Config = project.pm2Config;

  if (!nginxConfig && project.webServer === "nginx") {
    nginxConfig = generateNginxConfig({
      serverName,
      upstreamHost: "127.0.0.1",
      upstreamPort: port ?? 3000,
      mapSuffix,
      framework: project.framework,
      runtime: project.runtime,
      deploymentPath: project.deploymentPath,
      restartCommand: project.restartCommand,
      tlsCertPath: project.server.tlsCertPath?.trim() || undefined,
      tlsKeyPath: project.server.tlsKeyPath?.trim() || undefined
    });
  }
  if (!apacheConfig && project.webServer === "apache" && port != null) {
    apacheConfig = generateApacheConfig({
      serverName,
      upstreamHost: "127.0.0.1",
      upstreamPort: port,
      tlsCertPath: project.server.tlsCertPath || undefined,
      tlsKeyPath: project.server.tlsKeyPath || undefined,
      accessLog: `${logDir}/apache-access.log`,
      errorLog: `${logDir}/apache-error.log`
    });
  }

  if (port == null) {
    if (
      nginxConfig !== project.nginxConfig ||
      apacheConfig !== project.apacheConfig ||
      pm2Config !== project.pm2Config
    ) {
      await prisma.project.update({
        where: { id: project.id },
        data: { nginxConfig, apacheConfig, pm2Config }
      });
      return { ...project, nginxConfig, apacheConfig, pm2Config };
    }
    return project;
  }

  const appRoot = appRootFromDeploymentPath(project.deploymentPath, deployRoot);
  const cwd = `${currentSymlinkPath(appRoot)}`;

  if (project.runtime === "node" && port != null) {
    const startRaw = normalizeStartCommand(project.startCommand?.trim() || "npm run start");
    const start = substitutePort(startRaw, port);
    const launch = pm2LaunchFromStartCommand(start);
    pm2Config = generatePM2Config({
      appName: slug,
      cwd,
      script: launch.script,
      args: launch.args,
      interpreter: launch.interpreter,
      env: productionRuntimeEnv(project, port, "production", deployRoot),
      outFile: `${logDir}/pm2-out.log`,
      errorFile: `${logDir}/pm2-error.log`
    });
  } else if (project.runtime === "python" && port != null) {
    const startRaw =
      project.startCommand?.trim() ||
      ". .venv/bin/activate && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT}";
    const start = substitutePort(startRaw, port);
    pm2Config = generatePM2Config({
      appName: slug,
      cwd,
      script: "bash",
      args: `-lc ${JSON.stringify(start)}`,
      env: productionRuntimeEnv(project, port, "production", deployRoot),
      outFile: `${logDir}/pm2-out.log`,
      errorFile: `${logDir}/pm2-error.log`
    });
  }

  if (
    nginxConfig !== project.nginxConfig ||
    apacheConfig !== project.apacheConfig ||
    pm2Config !== project.pm2Config
  ) {
    await prisma.project.update({
      where: { id: project.id },
      data: { nginxConfig, apacheConfig, pm2Config }
    });
    return { ...project, nginxConfig, apacheConfig, pm2Config };
  }
  return project;
}

export async function applyInfraOnServer(input: {
  project: Project & { server: Server; envVars: ProjectEnvVar[] };
  target: DeployTarget;
  stream?: DeployStreamHandlers;
  deploymentId?: string;
  environmentSlug?: string;
}): Promise<void> {
  const { project, target, stream, deploymentId, environmentSlug = "production" } = input;
  const log = async (line: string) => {
    if (deploymentId) await appendDeploymentLogLine(deploymentId, line);
    else stream?.onStderr?.(`${line}\n`);
  };

  const phpStack = isPhpFpmStack(project.framework, project.runtime);
  const staticStack = isStaticStack(project.framework, project.runtime);
  if (!project.webServer) {
    await log("[infra] Skipped (set webServer on the project).");
    return;
  }
  if (!project.port && !phpStack && !staticStack) {
    await log("[infra] Skipped (set port and webServer on the project).");
    return;
  }

  const prepared = await prepareInfraApply({ project, target, environmentSlug });
  if (!prepared) {
    await log("[infra] Skipped (nothing to apply).");
    return;
  }

  await log("[infra] Applying nginx/Apache/PM2 and env on server…");
  await withSshSession(
    target,
    stream,
    { deploymentId },
    async (ssh) => {
      try {
        await ssh.exec(`bash -lc ${bashQ(prepared.bashScript)}`);
      } catch (e) {
        await log(
          `[infra] Apply failed. If stderr mentions sudo/password: ${SUDO_HINT}`
        );
        throw e;
      }
    }
  );
  await log("[infra] Applied successfully.");
}
