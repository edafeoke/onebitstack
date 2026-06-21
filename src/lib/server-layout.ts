/** Default root for Central-managed apps, configs, data, and logs on a VPS. */
export const DEFAULT_VPS_DEPLOY_ROOT = "/var/www/server";

/** Pre–deploy-root layout (still honored for existing projects). */
export const LEGACY_VPS_PATHS = {
  apps: "/var/www/apps",
  data: "/var/www/data",
  logs: "/var/www/logs",
  configs: "/var/www/configs",
  ssl: "/var/www/ssl",
  sharedApp: "/var/www/app"
} as const;

export type ServerLayout = {
  root: string;
  apps: string;
  configs: string;
  configsNginx: string;
  configsApache: string;
  configsPm2: string;
  data: string;
  logs: string;
  ssl: string;
};

export function normalizeDeployRoot(path?: string | null): string {
  const trimmed = path?.trim().replace(/\/+$/, "");
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_VPS_DEPLOY_ROOT;
}

export function serverLayoutFromRoot(deployRoot?: string | null): ServerLayout {
  const root = normalizeDeployRoot(deployRoot);
  return {
    root,
    apps: `${root}/apps`,
    configs: `${root}/configs`,
    configsNginx: `${root}/configs/nginx`,
    configsApache: `${root}/configs/apache`,
    configsPm2: `${root}/configs/pm2`,
    data: `${root}/data`,
    logs: `${root}/logs`,
    ssl: `${root}/ssl`
  };
}

export function defaultProjectDeploymentPath(deployRoot: string | null | undefined, slug: string): string {
  return `${serverLayoutFromRoot(deployRoot).apps}/${slug}`;
}

export function projectAppRoot(deploymentPath: string, deployRoot?: string | null): string {
  const trimmed = deploymentPath.replace(/\/+$/, "");
  if (trimmed) return trimmed;
  return `${serverLayoutFromRoot(deployRoot).apps}/app`;
}

export function persistentDatabasePath(slug: string, deployRoot?: string | null): string {
  return `${serverLayoutFromRoot(deployRoot).data}/${slug}/app.db`;
}

export function persistentDatabaseUrl(slug: string, deployRoot?: string | null): string {
  return `file:${persistentDatabasePath(slug, deployRoot)}`;
}

export function projectLogsDir(slug: string, deployRoot?: string | null): string {
  return `${serverLayoutFromRoot(deployRoot).logs}/${slug}`;
}

export function centralSslCertPath(deployRoot: string | null | undefined, slug: string): string {
  return `${serverLayoutFromRoot(deployRoot).ssl}/central/${slug}/fullchain.pem`;
}

export function centralSslKeyPath(deployRoot: string | null | undefined, slug: string): string {
  return `${serverLayoutFromRoot(deployRoot).ssl}/central/${slug}/privkey.pem`;
}

/** Paths that must never be removed as a project app root. */
export function protectedTeardownPaths(deployRoot?: string | null): readonly string[] {
  const layout = serverLayoutFromRoot(deployRoot);
  return [
    "/",
    "/var",
    "/var/www",
    LEGACY_VPS_PATHS.sharedApp,
    LEGACY_VPS_PATHS.apps,
    LEGACY_VPS_PATHS.data,
    LEGACY_VPS_PATHS.logs,
    LEGACY_VPS_PATHS.configs,
    layout.root,
    layout.apps,
    layout.data,
    layout.logs,
    layout.configs
  ];
}

export function isPersistentDataPath(absolutePath: string, deployRoot?: string | null): boolean {
  const p = absolutePath.replace(/\/+$/, "");
  const dataRoot = serverLayoutFromRoot(deployRoot).data;
  if (p.startsWith(`${dataRoot}/`)) return true;
  if (p.startsWith(`${LEGACY_VPS_PATHS.data}/`)) return true;
  return false;
}
