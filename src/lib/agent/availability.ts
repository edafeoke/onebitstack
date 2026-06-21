import type { Server } from "@/generated/prisma/client";

const HEARTBEAT_STALE_MS = 90_000;

export function isAgentOnline(
  server: Pick<Server, "agentStatus" | "lastAgentHeartbeatAt">
): boolean {
  if (server.agentStatus !== "connected") return false;
  if (!server.lastAgentHeartbeatAt) return false;
  return Date.now() - server.lastAgentHeartbeatAt.getTime() < HEARTBEAT_STALE_MS;
}
