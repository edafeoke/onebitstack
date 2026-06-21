import type { DeployTarget } from "@/lib/deploy/types";
import { withSshSession } from "@/lib/deploy/ssh-session";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import {
  projectSlugFromName,
  resolveRemoteLogCommand,
  type LogSource
} from "@/lib/server-logs/paths";

export async function fetchDeploymentLogLines(
  deploymentId: string,
  userId: string,
  tail: number
): Promise<string[]> {
  const dep = await prisma.deployment.findFirst({
    where: { id: deploymentId, project: projectsAccessibleWhere(userId) },
    select: { id: true }
  });
  if (!dep) return [];

  const chunks = await prisma.deploymentLogChunk.findMany({
    where: { deploymentId },
    orderBy: { seq: "desc" },
    take: tail
  });
  return chunks.reverse().map((c) => c.line);
}

export async function fetchRemoteLogSnapshot(input: {
  target: DeployTarget;
  source: LogSource;
  tail: number;
  projectName?: string;
}): Promise<{ text: string; label: string }> {
  const slug = input.projectName ? projectSlugFromName(input.projectName) : undefined;
  const resolved = resolveRemoteLogCommand({
    source: input.source,
    tail: input.tail,
    projectSlug: slug,
    pm2AppName: slug,
    deployRoot: input.target.deployRoot
  });
  if ("deployment" in resolved) {
    return { text: "", label: "deployment" };
  }

  const text = await withSshSession(input.target, undefined, undefined, async (ssh) =>
    ssh.execCapture(`bash -lc ${bashQ(resolved.command)}`)
  );
  return { text, label: resolved.label };
}

function bashQ(s: string): string {
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}
