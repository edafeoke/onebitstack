import { appendDeploymentLogLine } from "@/lib/deploy/deployment-log";
import type { DeployStreamHandlers } from "@/lib/deploy/types";
import {
  appRootFromDeploymentPath,
  releaseDirForDeployment
} from "@/lib/deploy/releases";
import { isAgentOnline } from "@/lib/agent/availability";
import { createAgentJob, waitForAgentJobCompletion } from "@/lib/agent/jobs";
import { buildAgentFullDeployScript } from "@/lib/agent/script";
import { isAgentPrimaryMode } from "@/lib/production/config";
import { prisma } from "@/lib/prisma";

const AGENT_JOB_TIMEOUT_MS = 2 * 60 * 60 * 1000;

type DeploymentBundle = Awaited<ReturnType<typeof loadDeploymentBundle>>;

async function loadDeploymentBundle(deploymentId: string) {
  return prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      environment: true,
      project: { include: { server: true, envVars: true } }
    }
  });
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

export function canUseAgentForDeployment(
  server: { agentStatus: string; lastAgentHeartbeatAt: Date | null; agentId: string | null },
  kind: string
): boolean {
  if (kind !== "full") return false;
  if (!server.agentId) return false;
  return isAgentOnline(server);
}

export function agentPrimaryBlocksSshFallback(server: {
  agentId: string | null;
}): boolean {
  return isAgentPrimaryMode() && Boolean(server.agentId);
}

export async function runDeploymentViaAgent(
  deploymentId: string,
  bundle: NonNullable<DeploymentBundle>,
  _stream: DeployStreamHandlers
): Promise<{ ok: true } | { ok: false; message: string; fallbackSsh?: boolean }> {
  const { project, environment } = bundle;
  const server = project.server;

  const script = await buildAgentFullDeployScript({
    deployment: bundle,
    project,
    environment,
    server,
    envVars: project.envVars
  });

  if (!script) {
    return {
      ok: false,
      message: "Agent cannot run this deployment kind.",
      fallbackSsh: !agentPrimaryBlocksSshFallback(server)
    };
  }

  await appendDeploymentLogLine(
    deploymentId,
    `[agent] Queuing build + infra on ${server.host} (central-agent)`
  );

  await createAgentJob({ serverId: server.id, deploymentId, script });

  const result = await waitForAgentJobCompletion(deploymentId, AGENT_JOB_TIMEOUT_MS);
  if (result.timedOut) {
    return {
      ok: false,
      message: "Agent job timed out.",
      fallbackSsh: !agentPrimaryBlocksSshFallback(server)
    };
  }
  if (!result.ok) {
    return {
      ok: false,
      message: `Agent exited with code ${result.exitCode ?? 1}.`,
      fallbackSsh: !agentPrimaryBlocksSshFallback(server)
    };
  }

  const appRoot = appRootFromDeploymentPath(project.deploymentPath, server.deployRoot);
  const releasePath = releaseDirForDeployment(appRoot, deploymentId);
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { releasePath }
  });

  return { ok: true };
}

export { loadDeploymentBundle, createStreamLogger };
