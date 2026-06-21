import type { Project, ProjectEnvVar } from "@/generated/prisma/client";
import { withProductionAuthUrls } from "@/lib/auth-config";
import { slugify } from "@/lib/deploy/slug";
import { envRecordForEnvironment } from "@/lib/project-env";
import {
  isPersistentDataPath,
  persistentDatabasePath,
  persistentDatabaseUrl
} from "@/lib/server-layout";

export { persistentDatabasePath, persistentDatabaseUrl };

/** Use a stable DB path in production unless the operator set an absolute file: URL outside the repo. */
export function resolveProductionDatabaseUrl(
  slug: string,
  configured?: string,
  deployRoot?: string | null
): string {
  const db = configured?.trim();
  if (db && /^file:\//.test(db) && !db.startsWith("file:./")) {
    return db;
  }
  return persistentDatabaseUrl(slug, deployRoot);
}

/** True when a SQLite path should be moved off the release directory to persistent data. */
export function shouldUsePersistentSqlitePath(
  dbPath?: string,
  deployRoot?: string | null
): boolean {
  const p = dbPath?.trim() ?? "";
  if (!p) return true;
  if (p.startsWith("file:./") || p.startsWith("./")) return true;
  if (!p.startsWith("/") && !p.startsWith("file:")) return true;
  const absolute = p.startsWith("file:") ? p.replace(/^file:/, "") : p;
  if (absolute.includes("/releases/") || absolute.includes("/current/")) return true;
  if (isPersistentDataPath(absolute, deployRoot)) return false;
  return false;
}

/** Laravel DB_* / DATABASE_URL for SQLite outside release checkouts. */
export function resolveProductionPhpDatabase(
  slug: string,
  env: Record<string, string>,
  deployRoot?: string | null
): Record<string, string> {
  const out = { ...env };
  const connection = (out.DB_CONNECTION ?? "sqlite").trim().toLowerCase();

  if (connection !== "sqlite") {
    if (out.DATABASE_URL?.trim()) {
      out.DATABASE_URL = resolveProductionDatabaseUrl(slug, out.DATABASE_URL, deployRoot);
    }
    return out;
  }

  const persistent = persistentDatabasePath(slug, deployRoot);
  if (shouldUsePersistentSqlitePath(out.DB_DATABASE, deployRoot)) {
    out.DB_CONNECTION = "sqlite";
    out.DB_DATABASE = persistent;
  }
  if (shouldUsePersistentSqlitePath(out.DATABASE_URL?.replace(/^file:/, ""), deployRoot)) {
    out.DATABASE_URL = persistentDatabaseUrl(slug, deployRoot);
  } else if (out.DATABASE_URL?.trim()) {
    out.DATABASE_URL = resolveProductionDatabaseUrl(slug, out.DATABASE_URL, deployRoot);
  } else if (!out.DB_DATABASE || shouldUsePersistentSqlitePath(out.DB_DATABASE, deployRoot)) {
    out.DATABASE_URL = persistentDatabaseUrl(slug, deployRoot);
  }

  return out;
}

export function productionRuntimeEnv(
  project: Project & { envVars: ProjectEnvVar[] },
  port: number,
  environmentSlug = "production",
  deployRoot?: string | null
): Record<string, string> {
  const slug = slugify(project.name);
  const withAuth = withProductionAuthUrls(
    {
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "0.0.0.0",
      ...envRecordForEnvironment(project.envVars, environmentSlug)
    },
    project.domain
  );
  return {
    ...withAuth,
    DATABASE_URL: resolveProductionDatabaseUrl(slug, withAuth.DATABASE_URL, deployRoot)
  };
}

/** Laravel / PHP-FPM `.env` on the VPS (no app TCP port). UI vars override defaults. */
export function productionPhpEnv(
  project: Project & { envVars: ProjectEnvVar[] },
  environmentSlug = "production",
  deployRoot?: string | null
): Record<string, string> {
  const slug = slugify(project.name);
  const fromUi = envRecordForEnvironment(project.envVars, environmentSlug);
  const defaults: Record<string, string> = {
    APP_ENV: "production",
    APP_DEBUG: "false"
  };
  const host = project.domain?.trim();
  if (host) {
    defaults.APP_URL = /^https?:\/\//i.test(host)
      ? host.replace(/\/+$/, "")
      : `https://${host}`;
  }
  const merged = { ...defaults, ...fromUi };
  return resolveProductionPhpDatabase(slug, merged, deployRoot);
}

export function formatEnvFile(env: Record<string, string>): string {
  const lines = Object.entries(env).map(([key, value]) => {
    const v = String(value);
    if (/[\s#"'\\]/.test(v)) {
      return `${key}="${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return `${key}=${v}`;
  });
  return `${lines.join("\n")}\n`;
}
