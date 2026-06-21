"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { WebStack } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  canManageServers,
  canPerformDestructiveOps,
  PERMISSION_DENIED_DESTRUCTIVE,
  PERMISSION_DENIED_SERVERS
} from "@/lib/auth/permissions";
import {
  getDefaultOrganizationIdForUser,
  serversAccessibleWhere
} from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { buildDeployTarget } from "@/lib/deploy/deploy-target";
import { withSshSession } from "@/lib/deploy/ssh-session";
import { probeDebianServer, buildDebianProvisionScript, type ProvisionFlags } from "@/lib/provision/debian";
import { appendProvisioningLogLine } from "@/lib/provision/provisioning-log";

async function appendProvisioningLines(runId: string, chunk: string, prefix: string) {
  const lines = chunk.split("\n");
  for (const line of lines) {
    if (line.length) await appendProvisioningLogLine(runId, `${prefix}${line}`);
  }
}

import { createServerFormSchema, updateServerFormSchema } from "@/lib/schemas/server";

const createServerSchema = createServerFormSchema;

export async function createServerAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  const parsed = createServerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const organizationId = await getDefaultOrganizationIdForUser(session.user.id);
  if (!(await canManageServers(session.user.id, organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_SERVERS };
  }
  const enc = encryptSecret(parsed.data.sshPrivateKey);
  await prisma.server.create({
    data: {
      userId: session.user.id,
      organizationId,
      name: parsed.data.name,
      host: parsed.data.host,
      sshUser: parsed.data.sshUser,
      sshPrivateKeyCipher: enc.cipherTextB64,
      sshPrivateKeyIv: enc.ivB64,
      sshPrivateKeyTag: enc.authTagB64,
      webStack: (parsed.data.webStack as WebStack) ?? WebStack.none,
      reverseProxyNotes: parsed.data.reverseProxyNotes?.trim() ?? "",
      tlsCertPath: parsed.data.tlsCertPath?.trim() ?? "",
      tlsKeyPath: parsed.data.tlsKeyPath?.trim() ?? "",
      reverseProxyConfigPath: parsed.data.reverseProxyConfigPath?.trim() ?? "",
      deployRoot: parsed.data.deployRoot
    }
  });
  revalidatePath("/dashboard/servers");
  return { ok: true };
}

const updateServerSchema = updateServerFormSchema.extend({
  id: z.string().min(1)
});

export async function updateServerAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  const parsed = updateServerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const existing = await prisma.server.findFirst({
    where: { id: parsed.data.id, ...serversAccessibleWhere(session.user.id) }
  });
  if (!existing) {
    return { ok: false, message: "Server not found" };
  }
  if (!(await canManageServers(session.user.id, existing.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_SERVERS };
  }

  const keyTrimmed = parsed.data.sshPrivateKey?.trim() ?? "";
  const enc =
    keyTrimmed.length > 0 ? encryptSecret(keyTrimmed) : null;

  await prisma.server.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      host: parsed.data.host,
      sshUser: parsed.data.sshUser,
      webStack: parsed.data.webStack as WebStack,
      reverseProxyNotes: parsed.data.reverseProxyNotes?.trim() ?? "",
      tlsCertPath: parsed.data.tlsCertPath?.trim() ?? "",
      tlsKeyPath: parsed.data.tlsKeyPath?.trim() ?? "",
      reverseProxyConfigPath: parsed.data.reverseProxyConfigPath?.trim() ?? "",
      deployRoot: parsed.data.deployRoot,
      ...(enc
        ? {
            sshPrivateKeyCipher: enc.cipherTextB64,
            sshPrivateKeyIv: enc.ivB64,
            sshPrivateKeyTag: enc.authTagB64
          }
        : {})
    }
  });

  revalidatePath("/dashboard/servers");
  revalidatePath(`/dashboard/servers/${existing.id}/edit`);
  revalidatePath("/dashboard/projects");
  return { ok: true };
}

const deleteServerSchema = z.object({
  id: z.string().min(1),
  confirmName: z.string().min(1)
});

export async function deleteServerAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  const parsed = deleteServerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.id, ...serversAccessibleWhere(session.user.id) },
    include: { _count: { select: { projects: true } } }
  });
  if (!server) {
    return { ok: false, message: "Server not found" };
  }
  if (server._count.projects > 0) {
    return {
      ok: false,
      message:
        `This server still has ${server._count.projects} project(s). Delete or reassign those projects before removing the server.`
    };
  }
  if (parsed.data.confirmName.trim() !== server.name) {
    return { ok: false, message: "Display name does not match. Type the exact server name to confirm." };
  }
  if (!(await canPerformDestructiveOps(session.user.id, server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  await prisma.server.delete({ where: { id: server.id } });

  revalidatePath("/dashboard/servers");
  revalidatePath(`/dashboard/servers/${server.id}/edit`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/projects/new");
  return { ok: true };
}

const probeServerSchema = z.object({ id: z.string().min(1) });

export async function probeServerCapabilitiesAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = probeServerSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.id, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) return { ok: false, message: "Server not found" };

  const target = buildDeployTarget(server, "/tmp");
  try {
    const caps = await probeDebianServer(target);
    await prisma.server.update({
      where: { id: server.id },
      data: {
        capabilitiesJson: JSON.stringify(caps),
        lastCapabilityProbeAt: new Date()
      }
    });
    revalidatePath(`/dashboard/servers/${server.id}`);
    revalidatePath(`/dashboard/servers/${server.id}/edit`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

const provisionServerSchema = z.object({
  id: z.string().min(1),
  git: z.boolean().optional(),
  nginx: z.boolean().optional(),
  apache: z.boolean().optional(),
  node: z.boolean().optional(),
  pm2: z.boolean().optional(),
  docker: z.boolean().optional(),
  bun: z.boolean().optional(),
  php: z.boolean().optional(),
  python: z.boolean().optional()
});

export async function provisionServerAction(
  input: unknown
): Promise<{ ok: true; runId: string } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };
  const parsed = provisionServerSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.id, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) return { ok: false, message: "Server not found" };
  if (!(await canPerformDestructiveOps(session.user.id, server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  const flags: ProvisionFlags = {
    git: Boolean(parsed.data.git),
    nginx: Boolean(parsed.data.nginx),
    apache: Boolean(parsed.data.apache),
    node: Boolean(parsed.data.node),
    pm2: Boolean(parsed.data.pm2),
    docker: Boolean(parsed.data.docker),
    bun: Boolean(parsed.data.bun),
    php: Boolean(parsed.data.php),
    python: Boolean(parsed.data.python)
  };
  if (!Object.values(flags).some(Boolean)) {
    return { ok: false, message: "Select at least one package to install." };
  }

  const run = await prisma.provisioningRun.create({
    data: { serverId: server.id, status: "running" }
  });
  await appendProvisioningLogLine(run.id, "[provision] Starting apt-based install…");

  const target = buildDeployTarget(server, "/tmp");
  const script = buildDebianProvisionScript(flags);
  const q = (s: string) => `'${s.replace(/'/g, `'\"'\"'`)}'`;

  try {
    let buf = "";
    await withSshSession(
      target,
      {
        onStdout: (c) => {
          buf += c;
          const parts = buf.split("\n");
          buf = parts.pop() ?? "";
          for (const p of parts) {
            if (p.length) void appendProvisioningLogLine(run.id, `[stdout] ${p}`);
          }
        },
        onStderr: (c) => {
          void appendProvisioningLines(run.id, c, "[stderr] ");
        }
      },
      undefined,
      async (ssh) => {
        await ssh.exec(`bash -lc ${q(script)}`);
      }
    );
    if (buf.trim()) await appendProvisioningLogLine(run.id, `[stdout] ${buf}`);
    await prisma.provisioningRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date() }
    });
    await appendProvisioningLogLine(run.id, "[provision] Finished.");
    await probeServerCapabilitiesAction({ id: server.id });
    revalidatePath(`/dashboard/servers/${server.id}`);
    return { ok: true, runId: run.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendProvisioningLogLine(run.id, `[provision] Failed: ${msg}`);
    await prisma.provisioningRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date() }
    });
    return { ok: false, message: msg };
  }
}
