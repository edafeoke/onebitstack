import { prisma } from "@/lib/prisma";
import { AGENT_JWT_TTL_SEC, signAgentJwt } from "@/lib/agent/jwt";
import {
  generateAgentId,
  generatePairingToken,
  hashAgentSecret
} from "@/lib/agent/tokens";

const PAIRING_TTL_MS = 15 * 60 * 1000;

export async function createServerPairingToken(serverId: string): Promise<string> {
  const token = generatePairingToken();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await prisma.server.update({
    where: { id: serverId },
    data: {
      agentPairingTokenHash: hashAgentSecret(token),
      agentPairingExpiresAt: expiresAt
    }
  });
  return token;
}

export async function pairAgentWithToken(input: {
  pairingToken: string;
  agentVersion?: string;
}): Promise<
  | { ok: true; accessToken: string; serverId: string; agentId: string }
  | { ok: false; message: string }
> {
  const hash = hashAgentSecret(input.pairingToken.trim());
  const server = await prisma.server.findFirst({
    where: {
      agentPairingTokenHash: hash,
      agentPairingExpiresAt: { gt: new Date() }
    }
  });
  if (!server) {
    return { ok: false, message: "Invalid or expired pairing token." };
  }

  const agentId = generateAgentId();
  const accessToken = signAgentJwt({ sub: agentId, serverId: server.id }, AGENT_JWT_TTL_SEC);
  const tokenHash = hashAgentSecret(accessToken);

  await prisma.server.update({
    where: { id: server.id },
    data: {
      agentId,
      agentTokenHash: tokenHash,
      agentStatus: "connected",
      agentVersion: input.agentVersion?.trim() || null,
      lastAgentHeartbeatAt: new Date(),
      agentPairingTokenHash: null,
      agentPairingExpiresAt: null
    }
  });

  return { ok: true, accessToken, serverId: server.id, agentId };
}

export async function disconnectServerAgent(serverId: string): Promise<void> {
  await prisma.server.update({
    where: { id: serverId },
    data: {
      agentStatus: "disconnected",
      agentId: null,
      agentTokenHash: null,
      agentVersion: null,
      lastAgentHeartbeatAt: null,
      agentPairingTokenHash: null,
      agentPairingExpiresAt: null
    }
  });
}
