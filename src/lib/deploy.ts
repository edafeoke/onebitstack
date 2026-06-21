import { Client } from "ssh2";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { registerSshClient, unregisterSshClient } from "@/lib/active-ssh";
import { loadPrivateKey } from "@/lib/deploy/load-key";
import { buildDeployTarget } from "@/lib/deploy/deploy-target";
import type { DeployConnectionOptions, DeployStreamHandlers, DeployTarget } from "@/lib/deploy/types";
import { applyInfraOnServer } from "@/lib/deploy/apply-infra";
import { projectNeedsInfra } from "@/lib/deploy/infra";
import { validateGithubBranchExists } from "@/lib/github/validate-branch";
import { appendDeploymentLogLine } from "@/lib/deploy/deployment-log";
import { persistentDatabaseUrl } from "@/lib/deploy/production-env";
import { isSqliteReadonlyDbMoved, reconnectPrisma } from "@/lib/prisma";
import {
  buildUsesNpm,
  normalizeBuildCommand,
  npmBuildEnv
} from "@/lib/deployment/normalize-commands";
import {
  appRootFromDeploymentPath,
  bashSingleQuoted,
  buildCleanupReleaseCommand,
  buildReleaseDeployCommand,
  currentSymlinkPath,
  projectSlugFromName,
  releaseDirForDeployment,
  sharedDirPath,
  sharedEnvPath
} from "@/lib/deploy/releases";
import { repoSlugFromRepository, resolveRemoteWorkTree } from "@/lib/deploy/work-tree";
import {
  canUseAgentForDeployment,
  runDeploymentViaAgent
} from "@/lib/agent/run-via-agent";
import { isAgentOnline } from "@/lib/agent/availability";
import { isAgentPrimaryMode } from "@/lib/production/config";

export { appendDeploymentLogLine } from "@/lib/deploy/deployment-log";

export { loadPrivateKey } from "@/lib/deploy/load-key";
export type { DeployConnectionOptions, DeployStreamHandlers, DeployTarget } from "@/lib/deploy/types";

/** Safe single-quoted literal for remote bash. */
export { interpolateDeployTemplates } from "@/lib/deploy/interpolate-templates";
import { interpolateDeployTemplates } from "@/lib/deploy/interpolate-templates";

/** Production: always `git@github.com:owner/repo.git` (HTTPS is not used for clone/fetch). */
function buildSshGitOriginUrl(repository: string): string {
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

/** Infra step already runs `pm2 startOrReload`; a follow-up `pm2 restart` often races a crashing app. */
function isRedundantPm2RestartAfterInfra(
  runtime: string | null,
  restartCommand: string
): boolean {
  if (runtime !== "node") return false;
  return /^pm2\s+(restart|reload)\s+/i.test(restartCommand.trim());
}

function buildRemoteCommand(
  deploymentPath: string,
  buildCommand: string,
  restartCommand: string,
  repository: string,
  branch: string,
  options?: {
    restartOnly?: boolean;
    skipRestart?: boolean;
    projectSlug?: string;
    /** Exported before build when project env includes DATABASE_URL. */
    envExports?: Record<string, string>;
  }
): string {
  const workTree = resolveRemoteWorkTree(deploymentPath, repository);
  const projectSlug = options?.projectSlug ?? repoSlugFromRepository(repository);
  const gitUrl = buildSshGitOriginUrl(repository);

  const q = bashSingleQuoted;
  const gitBlock = [
    "set -e",
    `BRANCH=${q(branch)}`,
    `WORKDIR=${q(workTree)}`,
    `GIT_URL=${q(gitUrl)}`,
    'mkdir -p "$WORKDIR"',
    'cd "$WORKDIR"',
    'if [ -d .git ]; then git remote set-url origin "$GIT_URL" && git fetch origin "$BRANCH" && git checkout "$BRANCH" && git reset --hard "origin/$BRANCH"; else if [ -n "$(ls -A 2>/dev/null || true)" ]; then echo "Refusing git clone: directory exists and is not a repo: $WORKDIR" >&2; exit 1; fi; git clone --branch "$BRANCH" --single-branch "$GIT_URL" .; fi'
  ].join(" && ");

  const restart = interpolateDeployTemplates(
    restartCommand.trim(),
    repository,
    workTree,
    projectSlug
  );

  if (options?.restartOnly) {
    const steps = [] as string[];
    if (restart) steps.push(restart);
    return steps.join(" && ") || "true";
  }

  const steps = [gitBlock];
  const build = interpolateDeployTemplates(
    normalizeBuildCommand(buildCommand),
    repository,
    workTree,
    projectSlug
  );
  if (build) {
    const exports = options?.envExports
      ? `${Object.entries(options.envExports)
          .map(([k, v]) => `export ${k}=${bashSingleQuoted(v)}`)
          .join(" && ")} && `
      : "";
    steps.push(exports + build);
  }
  if (!options?.skipRestart && restart) steps.push(restart);
  return steps.join(" && ");
}

export async function sshRunCommand(
  target: DeployTarget,
  command: string,
  stream: DeployStreamHandlers | undefined,
  deploymentId: string | undefined
): Promise<void> {
  const privateKey = loadPrivateKey(target.sshPrivateKey);
  const passphrase = process.env.SSH_KEY_PASSPHRASE;
  const attemptsRaw = Number(process.env.SSH_CONNECT_ATTEMPTS ?? "3");
  const maxAttempts = Math.min(
    10,
    Math.max(1, Number.isFinite(attemptsRaw) ? Math.floor(attemptsRaw) : 3)
  );
  const retryDelayRaw = Number(process.env.SSH_CONNECT_RETRY_MS ?? "2000");
  const retryDelayMs = Math.min(
    60_000,
    Math.max(200, Number.isFinite(retryDelayRaw) ? retryDelayRaw : 2000)
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sshConnectAndExecOnce(
        target,
        command,
        privateKey,
        passphrase,
        stream,
        deploymentId
      );
      return;
    } catch (e) {
      if (attempt < maxAttempts && transientSshTcpError(e)) {
        await emitDeployMeta(
          deploymentId,
          stream,
          `[deploy] SSH connect lost (${e instanceof Error ? e.message : String(e)}); retry ${attempt + 1}/${maxAttempts} in ${retryDelayMs}ms`
        );
        await sleep(retryDelayMs);
        continue;
      }
      throw wrapSshConnectError(target, e);
    }
  }
}

/** Release-based deploy (clone/build in releases/{id}, symlink `current`). */
export async function deployWithRelease(input: {
  deploymentId: string;
  projectName: string;
  repository: string;
  branch: string;
  deploymentPath: string;
  buildCommand: string;
  framework?: string | null;
  runtime?: string | null;
  target: DeployTarget;
  stream?: DeployStreamHandlers;
  connection?: DeployConnectionOptions;
  phase: "full" | "no_restart" | "cutover_only";
  buildEnv?: Record<string, string>;
  releaseDirOverride?: string;
}): Promise<{ releasePath: string }> {
  const appRoot = appRootFromDeploymentPath(input.deploymentPath, input.target.deployRoot);
  const releaseDir =
    input.releaseDirOverride ?? releaseDirForDeployment(appRoot, input.deploymentId);
  const projectSlug = projectSlugFromName(input.projectName);

  const command = buildReleaseDeployCommand({
    appRoot,
    releaseDir,
    currentLink: currentSymlinkPath(appRoot),
    sharedDir: sharedDirPath(appRoot),
    sharedEnv: sharedEnvPath(appRoot),
    repository: input.repository,
    branch: input.branch,
    buildCommand: input.buildCommand,
    framework: input.framework,
    runtime: input.runtime,
    projectSlug,
    envExports: input.buildEnv,
    phase: input.phase === "cutover_only" ? "cutover_only" : input.phase
  });

  const deploymentId = input.connection?.deploymentId;
  try {
    await sshRunCommand(input.target, command, input.stream, deploymentId);
    return { releasePath: releaseDir };
  } catch (e) {
    if (input.phase !== "cutover_only" && !input.releaseDirOverride) {
      try {
        await sshRunCommand(
          input.target,
          buildCleanupReleaseCommand(releaseDir),
          input.stream,
          deploymentId
        );
      } catch {
        // best-effort cleanup
      }
    }
    throw e;
  }
}


function errnoCode(err: unknown): string | undefined {
  const e = err as NodeJS.ErrnoException;
  return typeof e.code === "string" ? e.code : undefined;
}

/**
 * TCP or early-SSH failures where opening a new socket may succeed
 * (flaky path, middlebox reset, brief overload — not auth or remote command exit).
 */
function transientSshTcpError(err: unknown): boolean {
  const code = errnoCode(err);
  if (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/connection lost before handshake/i.test(msg)) return true;
  if (/socket hang up/i.test(msg)) return true;
  if (/timed out/i.test(msg)) return true;
  return false;
}

function connectFailureHintBlock(target: DeployTarget): string {
  const port = process.env.SSH_PORT?.trim();
  const portLabel = port && /^\d+$/.test(port) ? port : "22";
  return (
    ` — TCP/SSH to ${target.serverIp}:${portLabel} was reset or closed before the session became ready. ` +
    "That is almost always reachability, wrong SSH port, or a firewall/security group — not whether the private key matches. " +
    "From this machine run `nc -vz " +
    target.serverIp +
    " " +
    portLabel +
    "` or `ssh -v " +
    target.sshUser +
    "@" +
    target.serverIp +
    " -p " +
    portLabel +
    "`. On the VPS, confirm sshd listens on the public interface, check provider firewall and fail2ban, and allow this host's egress IP. " +
    "Env: SSH_PORT (non-default sshd port), SSH_CONNECT_ATTEMPTS, SSH_CONNECT_RETRY_MS, SSH_KEEPALIVE_MS."
  );
}

function wrapSshConnectError(target: DeployTarget, err: unknown): Error {
  if (!(err instanceof Error)) return new Error(String(err));
  if (err.message.includes("Remote command exited")) return err;
  const authFailed =
    (err as Error & { level?: string }).level === "client-authentication" ||
    err.message.includes("All configured authentication methods failed");
  if (authFailed) return err;
  if (!transientSshTcpError(err)) return err;
  return new Error(err.message + connectFailureHintBlock(target));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function emitDeployMeta(
  deploymentId: string | undefined,
  stream: DeployStreamHandlers | undefined,
  line: string
): Promise<void> {
  if (deploymentId) {
    await appendDeploymentLogLine(deploymentId, line);
    return;
  }
  if (stream?.onStderr) stream.onStderr(`${line}\n`);
  else console.warn(line);
}

function resolveSshConnectConfig(privateKey: Buffer, passphrase: string | undefined) {
  const readyTimeout = Number(process.env.SSH_READY_TIMEOUT_MS ?? 30_000);
  const keepaliveMs = Number(process.env.SSH_KEEPALIVE_MS ?? 10_000);
  const keepaliveCountMax = Number(process.env.SSH_KEEPALIVE_COUNT ?? 3);
  let port: number | undefined;
  const rawPort = process.env.SSH_PORT?.trim();
  if (rawPort) {
    const p = Number(rawPort);
    if (Number.isInteger(p) && p > 0 && p <= 65_535) port = p;
  }

  return {
    privateKey,
    ...(passphrase ? { passphrase } : {}),
    readyTimeout: Number.isFinite(readyTimeout) ? readyTimeout : 30_000,
    strictVendor: process.env.SSH2_STRICT_VENDOR === "0" ? false : true,
    ...(port !== undefined ? { port } : {}),
    ...(Number.isFinite(keepaliveMs) && keepaliveMs > 0
      ? {
          keepaliveInterval: keepaliveMs,
          keepaliveCountMax: Number.isFinite(keepaliveCountMax)
            ? Math.max(1, keepaliveCountMax)
            : 3
        }
      : {})
  };
}

function sshConnectAndExecOnce(
  target: DeployTarget,
  command: string,
  privateKey: Buffer,
  passphrase: string | undefined,
  stream: DeployStreamHandlers | undefined,
  deploymentId: string | undefined
): Promise<void> {
  const connectOpts = resolveSshConnectConfig(privateKey, passphrase);

  return new Promise<void>((resolvePromise, reject) => {
    const conn = new Client();
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    conn.on("close", () => {
      if (deploymentId) unregisterSshClient(deploymentId);
    });

    conn
      .on("ready", () => {
        if (deploymentId) registerSshClient(deploymentId, conn);
        conn.exec(command, (err, stream_) => {
          if (err) {
            conn.end();
            return settle(() => reject(err));
          }

          stream_
            .on("close", (code: number, signal?: string) => {
              conn.end();
              if (code !== 0) {
                return settle(() =>
                  reject(
                    new Error(
                      `Remote command exited with code ${code}${signal != null ? ` signal ${signal}` : ""}`
                    )
                  )
                );
              }
              settle(() => resolvePromise());
            })
            .on("data", (data: Buffer) => {
              const s = data.toString();
              if (stream?.onStdout) stream.onStdout(s);
              else process.stdout.write(s);
            });
          stream_.stderr.on("data", (data: Buffer) => {
            const s = data.toString();
            if (stream?.onStderr) stream.onStderr(s);
            else process.stderr.write(s);
          });
        });
      })
      .on("error", (err) => {
        conn.end();
        console.error("SSH failed:", err.message);
        const e = err as Error & { level?: string };
        const authFailed =
          e.level === "client-authentication" ||
          e.message.includes("All configured authentication methods failed");
        if (authFailed) {
          const hint = [
            `${e.message} (${target.sshUser}@${target.serverIp}).`,
            "The server rejected this key for that account.",
            "Check: (1) the matching PUBLIC key is in ~" +
              target.sshUser +
              "/.ssh/authorized_keys on the VPS,",
            "(2) chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys,",
            "(3) if the private key has a passphrase, set SSH_KEY_PASSPHRASE in this app's .env,",
            "(4) on the VPS, read sshd/auth logs for the exact reason (e.g. wrong user, wrong key, PubkeyAuthentication no)."
          ].join(" ");
          console.error(hint);
          settle(() => reject(new Error(hint)));
          return;
        }
        settle(() => reject(err));
      })
      .connect({
        host: target.serverIp,
        username: target.sshUser,
        ...connectOpts
      });
  });
}

export async function deployWithTarget(
  repository: string,
  branch: string,
  target: DeployTarget,
  stream?: DeployStreamHandlers,
  connection?: DeployConnectionOptions,
  phase: "full" | "no_restart" | "restart_only" = "full",
  buildEnv?: Record<string, string>
): Promise<void> {
  const privateKey = loadPrivateKey(target.sshPrivateKey);

  const command =
    phase === "restart_only"
      ? buildRemoteCommand(
          target.deploymentPath,
          target.buildCommand,
          target.restartCommand,
          repository,
          branch,
          { restartOnly: true }
        )
      : buildRemoteCommand(
          target.deploymentPath,
          target.buildCommand,
          target.restartCommand,
          repository,
          branch,
          {
            skipRestart: phase === "no_restart",
            envExports: buildEnv
          }
        );

  const passphrase = process.env.SSH_KEY_PASSPHRASE;
  const deploymentId = connection?.deploymentId;

  const attemptsRaw = Number(process.env.SSH_CONNECT_ATTEMPTS ?? "3");
  const maxAttempts = Math.min(
    10,
    Math.max(1, Number.isFinite(attemptsRaw) ? Math.floor(attemptsRaw) : 3)
  );
  const retryDelayRaw = Number(process.env.SSH_CONNECT_RETRY_MS ?? "2000");
  const retryDelayMs = Math.min(
    60_000,
    Math.max(200, Number.isFinite(retryDelayRaw) ? retryDelayRaw : 2000)
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sshConnectAndExecOnce(
        target,
        command,
        privateKey,
        passphrase,
        stream,
        deploymentId
      );
      return;
    } catch (e) {
      if (attempt < maxAttempts && transientSshTcpError(e)) {
        await emitDeployMeta(
          deploymentId,
          stream,
          `[deploy] SSH connect lost (${e instanceof Error ? e.message : String(e)}); retry ${attempt + 1}/${maxAttempts} in ${retryDelayMs}ms`
        );
        await sleep(retryDelayMs);
        continue;
      }
      throw wrapSshConnectError(target, e);
    }
  }
}

export async function deployProject(
  repository: string,
  branch: string,
  stream?: DeployStreamHandlers
): Promise<{ matched: boolean }> {
  console.log("Deploying project:", repository, branch);

  const project = await prisma.project.findFirst({
    where: { repository },
    include: {
      server: true,
      environments: { where: { branch } }
    }
  });

  if (!project || project.environments.length === 0) {
    console.log("No deployment config found");
    return { matched: false };
  }

  const target = buildDeployTarget(project.server, project.deploymentPath, {
    buildCommand: project.buildCommand,
    restartCommand: project.restartCommand
  });

  console.log("Deployment config:", {
    id: project.id,
    name: project.name,
    repository: project.repository,
    branch,
    serverIp: project.server.host,
    sshUser: project.server.sshUser,
    deploymentPath: project.deploymentPath,
    gitOriginSsh: buildSshGitOriginUrl(repository),
    hasBuildCommand: Boolean(project.buildCommand?.trim()),
    hasRestartCommand: Boolean(project.restartCommand?.trim())
  });

  await deployWithTarget(repository, branch, target, stream);
  return { matched: true };
}

export async function deployProjectById(
  projectId: string,
  environmentSlug: string | undefined,
  stream?: DeployStreamHandlers
): Promise<{ ok: true } | { ok: false; error: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      server: true,
      environments: environmentSlug
        ? { where: { slug: environmentSlug } }
        : { where: { slug: "production" } }
    }
  });
  if (!project) {
    return { ok: false, error: "Project not found" };
  }
  const env = project.environments[0];
  if (!env) {
    return { ok: false, error: "Environment not found" };
  }
  try {
    const target = buildDeployTarget(project.server, project.deploymentPath, {
      buildCommand: project.buildCommand,
      restartCommand: project.restartCommand
    });
    await deployWithTarget(project.repository, env.branch, target, stream);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function createStreamLogger(deploymentId: string, prefix: string) {
  let buf = "";
  return {
    push(chunk: string) {
      buf += chunk;
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const p of parts) {
        if (p.length) void appendDeploymentLogLine(deploymentId, `${prefix}${p}`);
      }
    },
    async flush() {
      if (buf.length) {
        await appendDeploymentLogLine(deploymentId, `${prefix}${buf}`);
        buf = "";
      }
    }
  };
}

export async function runDeploymentJob(deploymentId: string): Promise<void> {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      environment: true,
      project: { include: { server: true, envVars: true } }
    }
  });
  if (!deployment) {
    return;
  }

  if (deployment.status === "cancelled") {
    await appendDeploymentLogLine(
      deploymentId,
      "[deploy] Skipped (deployment was cancelled)."
    );
    return;
  }

  const { project, environment } = deployment;
  const server = project.server;
  const branch = environment.branch;
  const projectSlug = projectSlugFromName(project.name);
  const appRoot = appRootFromDeploymentPath(project.deploymentPath, server.deployRoot);
  const releasePath = releaseDirForDeployment(appRoot, deploymentId);

  if (project.githubInstallationId) {
    const check = await validateGithubBranchExists({
      installationId: project.githubInstallationId,
      repository: project.repository,
      branch
    });
    if (!check.ok) {
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: "failed", finishedAt: new Date() }
      });
      await appendDeploymentLogLine(deploymentId, `[deploy] ${check.message}`);
      return;
    }
  }

  const target = buildDeployTarget(server, project.deploymentPath, {
    buildCommand: project.buildCommand,
    restartCommand: project.restartCommand
  });

  const started = await prisma.deployment.updateMany({
    where: { id: deploymentId, status: "queued" },
    data: { status: "running", startedAt: new Date() }
  });

  if (started.count === 0) {
    const cur = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true }
    });
    if (cur?.status === "cancelled") {
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] Skipped (cancelled before run started)."
      );
      return;
    }
    if (cur?.status === "running") {
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] Skipped (already marked running)."
      );
      return;
    }
    await appendDeploymentLogLine(
      deploymentId,
      `[deploy] Skipped (unexpected status: ${cur?.status ?? "unknown"}).`
    );
    return;
  }

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: {
      releasePath: deployment.kind === "rollback" ? undefined : releasePath,
      assignedPort: project.port
    }
  });

  if (isAgentPrimaryMode() && deployment.kind === "full") {
    if (!server.agentId) {
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] AGENT_PRIMARY is enabled — pair central-agent on this server before deploying."
      );
      await updateDeploymentStatus(deploymentId, {
        status: "failed",
        finishedAt: new Date()
      });
      return;
    }
    if (!isAgentOnline(server)) {
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] AGENT_PRIMARY is enabled — central-agent must be online (check heartbeat)."
      );
      await updateDeploymentStatus(deploymentId, {
        status: "failed",
        finishedAt: new Date()
      });
      return;
    }
  }

  const outLog = createStreamLogger(deploymentId, "[stdout] ");
  const errLog = createStreamLogger(deploymentId, "[stderr] ");

  const stream: DeployStreamHandlers = {
    onStdout: (c) => outLog.push(c),
    onStderr: (c) => errLog.push(c)
  };

  if (canUseAgentForDeployment(server, deployment.kind)) {
    const agentResult = await runDeploymentViaAgent(deploymentId, deployment, stream);
    if (agentResult.ok) {
      await outLog.flush();
      await errLog.flush();
      const afterAgent = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        select: { status: true }
      });
      if (afterAgent?.status === "cancelled") {
        await appendDeploymentLogLine(deploymentId, "[deploy] Cancelled after agent run.");
        return;
      }
      await updateDeploymentStatus(deploymentId, {
        status: "success",
        finishedAt: new Date()
      });
      await appendDeploymentLogLine(deploymentId, "[deploy] Completed successfully (agent)");
      return;
    }
    if (agentResult.fallbackSsh === false) {
      await outLog.flush();
      await errLog.flush();
      await appendDeploymentLogLine(deploymentId, `[deploy] Failed: ${agentResult.message}`);
      await updateDeploymentStatus(deploymentId, {
        status: "failed",
        finishedAt: new Date()
      });
      return;
    }
    await appendDeploymentLogLine(
      deploymentId,
      `[deploy] Agent path failed — ${agentResult.message} Falling back to SSH.`
    );
  }

  await appendDeploymentLogLine(
    deploymentId,
    `[deploy] SSH → ${server.host} as ${server.sshUser} (${project.repository} @ ${branch})`
  );
  if (deployment.kind !== "config_only") {
    await appendDeploymentLogLine(
      deploymentId,
      `[deploy] Release layout: ${appRoot}/releases/{id} → current`
    );
    const build = project.buildCommand ?? "";
    if (/npm\s+ci\b/i.test(build)) {
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] Tip: npm ci falls back to npm install --legacy-peer-deps when the lockfile is missing or peer deps conflict."
      );
    }
  }

  const connection = { deploymentId };

  try {
    const kind = deployment.kind;
    const needsInfra = projectNeedsInfra(project);
    const buildEnv: Record<string, string> | undefined = (() => {
      const env: Record<string, string> = {};
      if (project.runtime === "node") {
        env.DATABASE_URL = persistentDatabaseUrl(projectSlug);
      }
      if (buildUsesNpm(project.buildCommand)) {
        Object.assign(env, npmBuildEnv());
      }
      return Object.keys(env).length > 0 ? env : undefined;
    })();

    if (kind === "rollback") {
      const parentId = deployment.parentDeploymentId;
      if (!parentId) {
        throw new Error("Rollback deployment is missing parentDeploymentId.");
      }
      const parent = await prisma.deployment.findFirst({
        where: { id: parentId, environmentId: environment.id, status: "success" },
        select: { releasePath: true }
      });
      if (!parent?.releasePath) {
        throw new Error("No prior successful release to roll back to.");
      }
      await appendDeploymentLogLine(
        deploymentId,
        `[deploy] Rolling back to release ${parent.releasePath}`
      );
      await deployWithRelease({
        deploymentId,
        projectName: project.name,
        repository: project.repository,
        branch,
        deploymentPath: project.deploymentPath,
        buildCommand: "",
        framework: project.framework,
        runtime: project.runtime,
        target,
        stream,
        connection,
        phase: "cutover_only",
        releaseDirOverride: parent.releasePath
      });
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { releasePath: parent.releasePath }
      });
      if (needsInfra) {
        await applyInfraOnServer({
          project: { ...project, envVars: project.envVars },
          target,
          stream,
          deploymentId,
          environmentSlug: environment.slug
        });
      }
    } else if (kind === "config_only") {
      await appendDeploymentLogLine(deploymentId, "[deploy] Config-only (infra reload)");
      await applyInfraOnServer({
        project: { ...project, envVars: project.envVars },
        target,
        stream,
        deploymentId,
        environmentSlug: environment.slug
      });
    } else if (needsInfra) {
      const { releasePath: deployedPath } = await deployWithRelease({
        deploymentId,
        projectName: project.name,
        repository: project.repository,
        branch,
        deploymentPath: project.deploymentPath,
        buildCommand: project.buildCommand,
        framework: project.framework,
        runtime: project.runtime,
        target,
        stream,
        connection,
        phase: "no_restart",
        buildEnv
      });
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { releasePath: deployedPath }
      });
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] Applying reverse-proxy / PM2 configs…"
      );
      await applyInfraOnServer({
        project: { ...project, envVars: project.envVars },
        target,
        stream,
        deploymentId,
        environmentSlug: environment.slug
      });
      if (project.restartCommand.trim()) {
        if (isRedundantPm2RestartAfterInfra(project.runtime, project.restartCommand)) {
          await appendDeploymentLogLine(
            deploymentId,
            "[deploy] Skipped separate pm2 restart (startOrReload already ran during infra)."
          );
        } else {
          const workTree = `${currentSymlinkPath(appRoot)}`;
          const restart = interpolateDeployTemplates(
            project.restartCommand.trim(),
            project.repository,
            workTree,
            projectSlug
          );
          await sshRunCommand(target, restart, stream, deploymentId);
        }
      }
    } else {
      const { releasePath: deployedPath } = await deployWithRelease({
        deploymentId,
        projectName: project.name,
        repository: project.repository,
        branch,
        deploymentPath: project.deploymentPath,
        buildCommand: project.buildCommand,
        framework: project.framework,
        runtime: project.runtime,
        target,
        stream,
        connection,
        phase: "full",
        buildEnv
      });
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { releasePath: deployedPath }
      });
    }
    await outLog.flush();
    await errLog.flush();

    const after = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true }
    });
    if (after?.status === "cancelled") {
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] SSH session ended after cancel."
      );
      return;
    }

    await updateDeploymentStatus(deploymentId, {
      status: "success",
      finishedAt: new Date()
    });
    await appendDeploymentLogLine(deploymentId, "[deploy] Completed successfully");
  } catch (e) {
    await outLog.flush();
    await errLog.flush();
    const cur = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { status: true }
    });
    if (cur?.status === "cancelled") {
      await appendDeploymentLogLine(
        deploymentId,
        "[deploy] Stopped (cancelled during run)."
      );
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    await appendDeploymentLogLine(deploymentId, `[deploy] Failed: ${msg}`);
    await updateDeploymentStatus(deploymentId, {
      status: "failed",
      finishedAt: new Date()
    });
  } finally {
    unregisterSshClient(deploymentId);
    await reconnectPrisma().catch(() => {});
  }
}

async function updateDeploymentStatus(
  deploymentId: string,
  data: { status: "success" | "failed"; finishedAt: Date }
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.deployment.update({ where: { id: deploymentId }, data });
      return;
    } catch (err) {
      if (isSqliteReadonlyDbMoved(err) && attempt < 2) {
        await reconnectPrisma();
        continue;
      }
      throw err;
    }
  }
}
