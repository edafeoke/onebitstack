import type { Project } from "@/generated/prisma/client";
import type { DeployStreamHandlers, DeployTarget } from "@/lib/deploy/types";
import { RUN_ROOT_HELPER, SUDO_HINT } from "@/lib/deploy/remote-shell";
import { slugify } from "@/lib/deploy/slug";
import { withSshSession } from "@/lib/deploy/ssh-session";
import { validateTeardownAppRoot } from "@/lib/deploy/teardown-path";
import {
  LEGACY_VPS_PATHS,
  persistentDatabasePath,
  projectLogsDir,
  serverLayoutFromRoot
} from "@/lib/server-layout";

function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

export type TeardownInput = {
  slug: string;
  appRoot: string;
  deployRoot: string;
  webServer?: string | null;
  runtime?: string | null;
  skipAppDirectoryRemoval?: boolean;
};

export function buildProjectTeardownScript(input: TeardownInput): string {
  const slug = input.slug;
  const appRootPath = input.appRoot.replace(/\/+$/, "");
  const skipAppDir = input.skipAppDirectoryRemoval ?? false;
  const layout = serverLayoutFromRoot(input.deployRoot);
  const dataDir = persistentDatabasePath(slug, input.deployRoot).replace(/\/[^/]+$/, "");
  const logDir = projectLogsDir(slug, input.deployRoot);
  const web = (input.webServer ?? "").trim().toLowerCase();
  const rt = (input.runtime ?? "").trim().toLowerCase();
  const usesPm2 = rt === "node" || rt === "python";

  const lines: string[] = [
    "set -e",
    RUN_ROOT_HELPER,
    `SLUG=${bashQ(slug)}`,
    `APP_ROOT=${bashQ(appRootPath)}`,
    `DATA_DIR=${bashQ(dataDir)}`,
    `LOG_DIR=${bashQ(logDir)}`,
    'echo "[teardown] Starting server cleanup…"'
  ];

  if (usesPm2) {
    lines.push(
      'echo "[teardown] Removing PM2 process…"',
      `pm2 delete "$SLUG" 2>/dev/null || true`,
      `rm -f ${bashQ(`${layout.configsPm2}/${slug}.config.cjs`)}`,
      "pm2 save 2>/dev/null || true"
    );
  }

  if (web === "nginx") {
    const drop = `${layout.configsNginx}/${slug}.conf`;
    const siteAvail = `/etc/nginx/sites-available/${slug}.conf`;
    const siteEnabled = `/etc/nginx/sites-enabled/${slug}.conf`;
    lines.push(
      'echo "[teardown] Removing nginx site…"',
      `run_root rm -f ${bashQ(siteEnabled)}`,
      `run_root rm -f ${bashQ(siteAvail)}`,
      `run_root rm -f ${bashQ(drop)}`,
      `if ! run_root nginx -t; then echo "nginx config test failed after site removal" >&2; exit 1; fi`,
      "run_root systemctl reload nginx"
    );
  }

  if (web === "apache") {
    const drop = `${layout.configsApache}/${slug}.conf`;
    const siteAvail = `/etc/apache2/sites-available/${slug}.conf`;
    lines.push(
      'echo "[teardown] Removing apache site…"',
      `run_root a2dissite ${bashQ(`${slug}.conf`)} 2>/dev/null || true`,
      `run_root rm -f ${bashQ(siteAvail)}`,
      `run_root rm -f ${bashQ(drop)}`,
      `if ! run_root apachectl configtest; then echo "apache config test failed after site removal" >&2; exit 1; fi`,
      "run_root systemctl reload apache2"
    );
  }

  if (skipAppDir) {
    lines.push(
      'echo "[teardown] Skipping app directory removal (shared or legacy deployment path)."',
      'echo "[teardown] Remove project files manually if needed."'
    );
  } else {
    lines.push(
      'echo "[teardown] Removing app directory…"',
      'test -n "$APP_ROOT"',
      `test "$APP_ROOT" != ${bashQ("/")}`,
      `test "$APP_ROOT" != ${bashQ("/var/www")}`,
      `test "$APP_ROOT" != ${bashQ(LEGACY_VPS_PATHS.sharedApp)}`,
      `test "$APP_ROOT" != ${bashQ(LEGACY_VPS_PATHS.apps)}`,
      `test "$APP_ROOT" != ${bashQ(layout.root)}`,
      `test "$APP_ROOT" != ${bashQ(layout.apps)}`,
      `run_root rm -rf "$APP_ROOT"`
    );
  }

  lines.push(
    'echo "[teardown] Removing logs…"',
    `rm -rf "$LOG_DIR"`,
    'echo "[teardown] Removing persistent data…"',
    `run_root rm -rf "$DATA_DIR"`,
    'echo "[teardown] Cleanup complete."'
  );

  return lines.join("\n");
}

export type TeardownResult =
  | { ok: true; lines: string[] }
  | { ok: false; message: string; lines: string[] };

function createLineCollector(): { stream: DeployStreamHandlers; lines: string[] } {
  const lines: string[] = [];
  const push = (chunk: string) => {
    for (const line of chunk.split("\n")) {
      const t = line.trimEnd();
      if (t.length) lines.push(t);
    }
  };
  return {
    lines,
    stream: {
      onStdout: push,
      onStderr: push
    }
  };
}

export async function teardownProjectOnServer(input: {
  project: Pick<Project, "name" | "deploymentPath" | "webServer" | "runtime">;
  target: DeployTarget;
}): Promise<TeardownResult> {
  const slug = slugify(input.project.name);
  const pathCheck = validateTeardownAppRoot(
    input.project.deploymentPath,
    slug,
    input.target.deployRoot
  );
  if (!pathCheck.ok) {
    return { ok: false, message: pathCheck.reason, lines: [] };
  }

  const script = buildProjectTeardownScript({
    slug,
    appRoot: pathCheck.appRoot,
    deployRoot: input.target.deployRoot,
    webServer: input.project.webServer,
    runtime: input.project.runtime,
    skipAppDirectoryRemoval: pathCheck.skipAppDirectoryRemoval
  });
  const { stream, lines } = createLineCollector();

  try {
    await withSshSession(input.target, stream, undefined, async (ssh) => {
      await ssh.exec(`bash -lc ${bashQ(script)}`);
    });
    return { ok: true, lines };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `${msg}. ${SUDO_HINT}`,
      lines
    };
  }
}
