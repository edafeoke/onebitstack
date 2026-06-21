import { prisma } from "@/lib/prisma";
import { listRemoteListenPorts } from "@/lib/port-allocation-remote";
import type { DeployTarget } from "@/lib/deploy/types";

const DEFAULT_MIN = 3001;
const DEFAULT_MAX = 3999;

export function portBounds(): { min: number; max: number } {
  const minRaw = Number(process.env.APP_PORT_MIN ?? DEFAULT_MIN);
  const maxRaw = Number(process.env.APP_PORT_MAX ?? DEFAULT_MAX);
  const min = Number.isFinite(minRaw) ? Math.floor(minRaw) : DEFAULT_MIN;
  const max = Number.isFinite(maxRaw) ? Math.floor(maxRaw) : DEFAULT_MAX;
  return { min: Math.max(1, min), max: Math.min(65535, Math.max(min, max)) };
}

/** Whether the stack needs a TCP app port (reverse-proxy / PM2). */
export function projectNeedsAppPort(
  framework?: string | null,
  runtime?: string | null
): boolean {
  const fw = (framework ?? "").trim().toLowerCase();
  const rt = (runtime ?? "").trim().toLowerCase();
  if (
    fw === "laravel" ||
    fw === "php" ||
    fw === "laravel-react" ||
    rt === "php-fpm" ||
    rt === "php"
  ) {
    return false;
  }
  if (fw === "static" && rt === "static") return false;
  return true;
}

function firstFreeInRange(
  taken: Set<number>,
  min: number,
  max: number,
  exclude?: number
): number {
  for (let p = min; p <= max; p++) {
    if (p === exclude) continue;
    if (!taken.has(p)) return p;
  }
  throw new Error(`No free app port in range ${min}-${max} for this server.`);
}

/**
 * Next free TCP port on a server for app listen, within configured bounds.
 * Optionally merges ports in use on the VPS (SSH scan).
 */
export async function allocateNextAppPort(
  serverId: string,
  options?: { remoteTarget?: DeployTarget; excludePort?: number }
): Promise<number> {
  const { min, max } = portBounds();
  const remoteTaken = options?.remoteTarget
    ? await listRemoteListenPorts(options.remoteTarget)
    : new Set<number>();

  return prisma.$transaction(async (tx) => {
    const used = await tx.project.findMany({
      where: { serverId, port: { not: null } },
      select: { port: true }
    });
    const taken = new Set(used.map((p) => p.port!).filter(Boolean));
    for (const p of remoteTaken) taken.add(p);
    if (options?.excludePort != null) taken.delete(options.excludePort);
    return firstFreeInRange(taken, min, max, options?.excludePort);
  });
}

export async function suggestNextAppPort(
  serverId: string,
  options?: { remoteTarget?: DeployTarget }
): Promise<number> {
  return allocateNextAppPort(serverId, options);
}

/** Validate port is not taken in DB or on the remote host (no range restriction). */
export async function validateProjectPort(input: {
  serverId: string;
  port: number;
  projectId?: string;
  remoteTarget?: DeployTarget;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    return { ok: false, message: "Port must be an integer between 1 and 65535." };
  }

  const conflict = await prisma.project.findFirst({
    where: {
      serverId: input.serverId,
      port: input.port,
      ...(input.projectId ? { NOT: { id: input.projectId } } : {})
    },
    select: { name: true }
  });
  if (conflict) {
    return {
      ok: false,
      message: `Port ${input.port} is already used by project "${conflict.name}".`
    };
  }

  if (input.remoteTarget) {
    const remote = await listRemoteListenPorts(input.remoteTarget);
    if (remote.has(input.port)) {
      return {
        ok: false,
        message: `Port ${input.port} is already listening on the server (not tracked in Central).`
      };
    }
  }

  return { ok: true };
}

/** Allocate and persist a port when the project needs one but has none. */
export async function ensureProjectPort(input: {
  projectId: string;
  serverId: string;
  framework?: string | null;
  runtime?: string | null;
  remoteTarget?: DeployTarget;
}): Promise<number | null> {
  if (!projectNeedsAppPort(input.framework, input.runtime)) return null;

  const row = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { port: true }
  });
  if (row?.port != null) return row.port;

  const port = await allocateNextAppPort(input.serverId, {
    remoteTarget: input.remoteTarget
  });
  await prisma.project.update({
    where: { id: input.projectId },
    data: { port }
  });
  return port;
}
