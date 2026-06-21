import { buildDeployTarget } from "@/lib/deploy/deploy-target";
import type { DeployTarget } from "@/lib/deploy/types";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export async function deployTargetForServer(
  serverId: string,
  userId: string
): Promise<{
  server: {
    id: string;
    name: string;
    host: string;
    organizationId: string;
    tlsCertPath: string;
    tlsKeyPath: string;
  };
  target: DeployTarget;
} | null> {
  const server = await prisma.server.findFirst({
    where: { id: serverId, ...serversAccessibleWhere(userId) }
  });
  if (!server) return null;

  return {
    server: {
      id: server.id,
      name: server.name,
      host: server.host,
      organizationId: server.organizationId,
      tlsCertPath: server.tlsCertPath,
      tlsKeyPath: server.tlsKeyPath
    },
    target: buildDeployTarget(server, "/tmp")
  };
}
