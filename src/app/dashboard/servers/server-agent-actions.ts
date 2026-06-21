"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canManageServers, PERMISSION_DENIED_SERVERS } from "@/lib/auth/permissions";
import { createServerPairingToken, disconnectServerAgent } from "@/lib/agent/pairing";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

const idSchema = z.object({ serverId: z.string().min(1) });

export async function generateAgentPairingTokenAction(
  input: unknown
): Promise<{ ok: true; token: string; expiresInMinutes: number } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid server" };

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.serverId, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) return { ok: false, message: "Server not found" };
  if (!(await canManageServers(session.user.id, server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_SERVERS };
  }

  const token = await createServerPairingToken(server.id);
  revalidatePath(`/dashboard/servers/${server.id}`);
  return { ok: true, token, expiresInMinutes: 15 };
}

export async function disconnectAgentAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid server" };

  const server = await prisma.server.findFirst({
    where: { id: parsed.data.serverId, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) return { ok: false, message: "Server not found" };
  if (!(await canManageServers(session.user.id, server.organizationId))) {
    return { ok: false, message: PERMISSION_DENIED_SERVERS };
  }

  await disconnectServerAgent(server.id);
  revalidatePath(`/dashboard/servers/${server.id}`);
  return { ok: true };
}
