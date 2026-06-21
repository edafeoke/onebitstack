const PKG_MANAGER = /^(npm|npx|yarn|pnpm|bun)(\s|$)/i;

export type NormalizeBuildOptions = {
  framework?: string | null;
  runtime?: string | null;
};

const NPM_INSTALL_FALLBACK = "npm install --legacy-peer-deps";
const NPM_CI_WITH_FALLBACK = `(npm ci --legacy-peer-deps || ${NPM_INSTALL_FALLBACK})`;

/** Whether the build command runs npm install/ci (for deploy env). */
export function buildUsesNpm(cmd: string): boolean {
  return /\bnpm\s+(ci|install)\b/i.test(cmd);
}

/** Env vars to apply during remote npm-based builds. */
export function npmBuildEnv(): Record<string, string> {
  return { NPM_CONFIG_LEGACY_PEER_DEPS: "true" };
}

/** Rewrite `npm ci` to fall back to `npm install --legacy-peer-deps` when ci fails (no lockfile, peer conflicts). */
export function withNpmCiFallback(cmd: string): string {
  return cmd.replace(/\bnpm ci\b/g, NPM_CI_WITH_FALLBACK);
}

/**
 * Normalize a remote build command so dependencies and npm scripts run correctly.
 * `next build` from package.json is not on PATH over SSH — use npm run build.
 */
/** Strip `prisma db push` — must not run during SSH deploy while the control plane holds SQLite open. */
export function stripPrismaPushFromBuild(cmd: string): string {
  return cmd
    .replace(/\s*&&\s*(npx\s+)?prisma\s+db\s+push\b/gi, "")
    .replace(/^(npx\s+)?prisma\s+db\s+push\s*&&\s*/gi, "")
    .replace(/^(npx\s+)?prisma\s+db\s+push\s*$/gi, "true")
    .trim();
}

function isPhpBuildStack(framework?: string | null, runtime?: string | null): boolean {
  const fw = (framework ?? "").trim().toLowerCase();
  const rt = (runtime ?? "").trim().toLowerCase();
  return (
    fw === "laravel" ||
    fw === "php" ||
    fw === "laravel-react" ||
    rt === "php-fpm" ||
    rt === "php"
  );
}

function isStaticBuildStack(framework?: string | null, runtime?: string | null): boolean {
  const fw = (framework ?? "").trim().toLowerCase();
  const rt = (runtime ?? "").trim().toLowerCase();
  return fw === "static" && rt === "static";
}

export function normalizeBuildCommand(
  cmd: string,
  options?: NormalizeBuildOptions
): string {
  const t = cmd.trim();
  const isPhp = isPhpBuildStack(options?.framework, options?.runtime);
  const isStatic = isStaticBuildStack(options?.framework, options?.runtime);

  if (!t) {
    if (isPhp) return "composer install --no-dev --optimize-autoloader";
    if (isStatic) return "";
    return withNpmCiFallback("npm ci && npm run build");
  }
  if (PKG_MANAGER.test(t)) {
    return withNpmCiFallback(stripPrismaPushFromBuild(t));
  }
  if (/^next\s+build/i.test(t) || /^vite\s+build/i.test(t) || /^react-scripts\s+build/i.test(t)) {
    return withNpmCiFallback("npm ci && npm run build");
  }
  if (/^composer\s/i.test(t)) return stripPrismaPushFromBuild(t);
  return withNpmCiFallback(stripPrismaPushFromBuild(t));
}

/**
 * Normalize start command for PM2 / remote shell (e.g. `next start` → `npm run start`).
 */
export function normalizeStartCommand(cmd: string): string {
  const t = cmd.trim();
  if (!t) return "npm run start";
  if (PKG_MANAGER.test(t) || /^pm2\s/i.test(t) || /^sudo\s/i.test(t) || /^node\s/i.test(t)) {
    return t;
  }
  if (/^next\s+start/i.test(t)) return "npm run start";
  return t;
}

export type Pm2LaunchSpec = {
  script: string;
  /** Single string avoids PM2 defaulting to `bash` and treating `run` as the script file. */
  args?: string;
  interpreter: "none";
};

/** PM2 launch spec: npm/npx/node with `interpreter: "none"` (not bash-wrapped). */
export function pm2LaunchFromStartCommand(startCommand: string): Pm2LaunchSpec {
  const t = normalizeStartCommand(startCommand.trim());
  if (/^npm\s+/i.test(t)) {
    return { script: "npm", args: t.replace(/^npm\s+/i, ""), interpreter: "none" };
  }
  if (/^npx\s+/i.test(t)) {
    return { script: "npx", args: t.replace(/^npx\s+/i, ""), interpreter: "none" };
  }
  if (/^node\s+/i.test(t)) {
    return { script: "node", args: t.replace(/^node\s+/i, ""), interpreter: "none" };
  }
  return { script: "npm", args: "run start", interpreter: "none" };
}
