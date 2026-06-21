import { prisma } from "@/lib/prisma";
import { verifyAgentJwt, type AgentJwtPayload } from "@/lib/agent/jwt";
import { hashAgentSecret, timingSafeEqualHex } from "@/lib/agent/tokens";

export function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function authenticateAgentRequest(
  request: Request
): Promise<{ payload: AgentJwtPayload; serverId: string } | null> {
  const token = bearerTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyAgentJwt(token);
  if (!payload) return null;

  const server = await prisma.server.findFirst({
    where: { id: payload.serverId, agentId: payload.sub, agentStatus: "connected" },
    select: { id: true, agentTokenHash: true }
  });
  if (!server?.agentTokenHash) return null;

  const tokenHash = hashAgentSecret(token);
  if (!timingSafeEqualHex(tokenHash, server.agentTokenHash)) {
    return null;
  }

  return { payload, serverId: server.id };
}
