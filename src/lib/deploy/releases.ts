import {
  buildUsesNpm,
  normalizeBuildCommand,
  npmBuildEnv
} from "@/lib/deployment/normalize-commands";
import { slugify } from "@/lib/deploy/slug";

import { projectAppRoot } from "@/lib/server-layout";

/** App root on the VPS (project `deploymentPath`, e.g. `<deployRoot>/apps/my-app`). */
export function appRootFromDeploymentPath(
  deploymentPath: string,
  deployRoot?: string | null
): string {
  return projectAppRoot(deploymentPath, deployRoot);
}

export function projectSlugFromName(name: string): string {
  return slugify(name);
}

export function releaseDirForDeployment(appRoot: string, deploymentId: string): string {
  return `${appRoot}/releases/${deploymentId}`;
}

export function currentSymlinkPath(appRoot: string): string {
  return `${appRoot}/current`;
}

export function sharedDirPath(appRoot: string): string {
  return `${appRoot}/shared`;
}

export function sharedEnvPath(appRoot: string): string {
  return `${appRoot}/shared/.env`;
}

export function sharedStoragePath(appRoot: string): string {
  return `${appRoot}/shared/storage`;
}

export function bashSingleQuoted(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

function interpolateCommand(
  cmd: string,
  projectSlug: string,
  workTree: string
): string {
  return cmd
    .replaceAll("{projectSlug}", projectSlug)
    .replaceAll("{repoSlug}", projectSlug)
    .replaceAll("{repo}", projectSlug)
    .replaceAll("{workTree}", bashSingleQuoted(workTree));
}

/** SSH git origin URL (same rules as deploy.ts). */
export function buildSshGitOriginUrl(repository: string): string {
  const r = repository.trim();
  if (r.startsWith("git@")) {
    return r.endsWith(".git") ? r : `${r}.git`;
  }
  const httpsMatch = r.match(
    /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i
  );
  if (httpsMatch) {
    return `git@github.com:${httpsMatch[1]}/${httpsMatch[2]}.git`;
  }
  return `git@github.com:${r}.git`;
}

export type ReleaseDeployPhase = "full" | "no_restart" | "cutover_only";

/**
 * Release-based deploy: clone/build in `releases/{deploymentId}`, then `ln -sfn` → `current`.
 * On build failure before cutover, the release directory is removed.
 */
export function buildReleaseDeployCommand(input: {
  appRoot: string;
  releaseDir: string;
  currentLink: string;
  sharedDir: string;
  sharedEnv: string;
  repository: string;
  branch: string;
  buildCommand: string;
  framework?: string | null;
  runtime?: string | null;
  projectSlug: string;
  envExports?: Record<string, string>;
  phase: ReleaseDeployPhase;
}): string {
  const q = bashSingleQuoted;
  const workTree = input.releaseDir;

  if (input.phase === "cutover_only") {
    return [
      "set -e",
      `RELEASE=${q(input.releaseDir)}`,
      `CURRENT=${q(input.currentLink)}`,
      `SHARED_ENV=${q(input.sharedEnv)}`,
      `test -d "$RELEASE"`,
      `ln -sfn "$RELEASE" "$CURRENT"`,
      `ln -sf "$SHARED_ENV" "$RELEASE/.env"`,
      "echo Release cutover complete."
    ].join("\n");
  }

  const gitUrl = buildSshGitOriginUrl(input.repository);
  const build = interpolateCommand(
    normalizeBuildCommand(input.buildCommand, {
      framework: input.framework,
      runtime: input.runtime
    }),
    input.projectSlug,
    workTree
  );

  const envExports = {
    ...(buildUsesNpm(input.buildCommand) || buildUsesNpm(build) ? npmBuildEnv() : {}),
    ...input.envExports
  };
  const exportPrefix =
    Object.keys(envExports).length > 0
      ? `${Object.entries(envExports)
          .map(([k, v]) => `export ${k}=${q(v)}`)
          .join("\n")}\n`
      : "";

  const lines = [
    "set -e",
    `APP_ROOT=${q(input.appRoot)}`,
    `RELEASE=${q(input.releaseDir)}`,
    `CURRENT=${q(input.currentLink)}`,
    `SHARED=${q(input.sharedDir)}`,
    `SHARED_ENV=${q(input.sharedEnv)}`,
    `GIT_URL=${q(gitUrl)}`,
    `BRANCH=${q(input.branch)}`,
    `mkdir -p "$APP_ROOT/releases" "$SHARED/storage"`,
    `if [ -d "$RELEASE" ]; then rm -rf "$RELEASE"; fi`,
    `git clone --branch "$BRANCH" --single-branch "$GIT_URL" "$RELEASE"`,
    `cd "$RELEASE"`,
    exportPrefix ? exportPrefix.trimEnd() : null,
    build
      ? `if ! (${build}); then rm -rf "$RELEASE"; echo "Build failed; removed release directory." >&2; exit 1; fi`
      : null,
    `ln -sfn "$RELEASE" "$CURRENT"`,
    `ln -sf "$SHARED_ENV" "$RELEASE/.env"`,
    "echo Release deployed to current."
  ].filter((l): l is string => Boolean(l));

  return lines.join("\n");
}

/** Remove a failed release directory (safe no-op if missing). */
export function buildCleanupReleaseCommand(releaseDir: string): string {
  const q = bashSingleQuoted;
  return `rm -rf ${q(releaseDir)} 2>/dev/null || true`;
}
