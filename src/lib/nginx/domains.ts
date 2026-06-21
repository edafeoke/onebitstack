import { prisma } from "@/lib/prisma";

const HOSTNAME_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$|^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeHostname(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

export function isValidHostname(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  if (!h || h.length > 253) return false;
  if (h.endsWith(".local")) return true;
  return HOSTNAME_RE.test(h);
}

/** Hostnames claimed by this project's nginx config (primary domain + project.domain field). */
export function hostnamesFromProject(input: {
  domain?: string | null;
  domains?: { hostname: string; isPrimary?: boolean }[];
}): string[] {
  const set = new Set<string>();
  for (const d of input.domains ?? []) {
    const h = normalizeHostname(d.hostname);
    if (h) set.add(h);
  }
  const legacy = input.domain?.trim();
  if (legacy) set.add(normalizeHostname(legacy));
  return [...set];
}

export async function findHostnameConflictOnServer(input: {
  serverId: string;
  hostname: string;
  excludeProjectId?: string;
}): Promise<{ projectId: string; projectName: string } | null> {
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) return null;

  const row = await prisma.projectDomain.findFirst({
    where: {
      hostname,
      serverId: input.serverId,
      ...(input.excludeProjectId ? { projectId: { not: input.excludeProjectId } } : {})
    },
    select: {
      projectId: true,
      project: { select: { name: true } }
    }
  });
  if (!row) return null;
  return { projectId: row.projectId, projectName: row.project.name };
}

export async function assertHostnamesAvailableOnServer(input: {
  serverId: string;
  hostnames: string[];
  excludeProjectId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const raw of input.hostnames) {
    const hostname = normalizeHostname(raw);
    if (!hostname) continue;
    if (!isValidHostname(hostname)) {
      return { ok: false, message: `Invalid hostname: ${raw}` };
    }
    const conflict = await findHostnameConflictOnServer({
      serverId: input.serverId,
      hostname,
      excludeProjectId: input.excludeProjectId
    });
    if (conflict) {
      return {
        ok: false,
        message: `Hostname ${hostname} is already used by project "${conflict.projectName}" on this server.`
      };
    }
  }
  return { ok: true };
}

export async function syncPrimaryProjectDomain(input: {
  projectId: string;
  serverId: string;
  hostname: string | null;
}): Promise<void> {
  await prisma.projectDomain.deleteMany({
    where: { projectId: input.projectId, isPrimary: true }
  });
  const h = input.hostname?.trim();
  if (!h) return;
  const hostname = normalizeHostname(h);
  await prisma.projectDomain.upsert({
    where: {
      projectId_hostname: { projectId: input.projectId, hostname }
    },
    create: {
      projectId: input.projectId,
      serverId: input.serverId,
      hostname,
      isPrimary: true
    },
    update: { isPrimary: true, serverId: input.serverId }
  });
}
