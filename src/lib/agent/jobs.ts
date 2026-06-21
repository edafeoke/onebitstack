import { AgentJobStatus } from "@/generated/prisma/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export async function createAgentJob(input: {
  serverId: string;
  deploymentId: string;
  script: string;
}): Promise<string> {
  const enc = encryptSecret(input.script);
  const job = await prisma.agentJob.create({
    data: {
      serverId: input.serverId,
      deploymentId: input.deploymentId,
      status: AgentJobStatus.pending,
      scriptCipher: enc.cipherTextB64,
      scriptIv: enc.ivB64,
      scriptTag: enc.authTagB64
    }
  });
  return job.id;
}

export function decryptAgentJobScript(job: {
  scriptCipher: string;
  scriptIv: string;
  scriptTag: string;
}): string {
  return decryptSecret({
    cipherTextB64: job.scriptCipher,
    ivB64: job.scriptIv,
    authTagB64: job.scriptTag
  });
}

export async function claimNextAgentJob(serverId: string): Promise<{
  id: string;
  deploymentId: string;
  script: string;
} | null> {
  const pending = await prisma.agentJob.findFirst({
    where: { serverId, status: AgentJobStatus.pending },
    orderBy: { createdAt: "asc" }
  });
  if (!pending) return null;

  const claimed = await prisma.agentJob.updateMany({
    where: { id: pending.id, status: AgentJobStatus.pending },
    data: { status: AgentJobStatus.claimed, claimedAt: new Date() }
  });
  if (claimed.count === 0) return null;

  return {
    id: pending.id,
    deploymentId: pending.deploymentId,
    script: decryptAgentJobScript(pending)
  };
}

export async function markAgentJobRunning(jobId: string, serverId: string): Promise<boolean> {
  const updated = await prisma.agentJob.updateMany({
    where: { id: jobId, serverId, status: AgentJobStatus.claimed },
    data: { status: AgentJobStatus.running, startedAt: new Date() }
  });
  return updated.count > 0;
}

export async function completeAgentJob(input: {
  jobId: string;
  serverId: string;
  exitCode: number;
}): Promise<{ deploymentId: string } | null> {
  const status = input.exitCode === 0 ? AgentJobStatus.success : AgentJobStatus.failed;
  const job = await prisma.agentJob.findFirst({
    where: {
      id: input.jobId,
      serverId: input.serverId,
      status: { in: [AgentJobStatus.claimed, AgentJobStatus.running] }
    }
  });
  if (!job) return null;

  await prisma.agentJob.update({
    where: { id: job.id },
    data: {
      status,
      exitCode: input.exitCode,
      finishedAt: new Date()
    }
  });
  return { deploymentId: job.deploymentId };
}

export async function waitForAgentJobCompletion(
  deploymentId: string,
  timeoutMs: number
): Promise<{ ok: boolean; exitCode?: number; timedOut?: boolean }> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = await prisma.agentJob.findUnique({
      where: { deploymentId },
      select: { status: true, exitCode: true }
    });
    if (!job) return { ok: false };
    if (job.status === AgentJobStatus.success) {
      return { ok: true, exitCode: job.exitCode ?? 0 };
    }
    if (job.status === AgentJobStatus.failed || job.status === AgentJobStatus.cancelled) {
      return { ok: false, exitCode: job.exitCode ?? 1 };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ok: false, timedOut: true };
}
