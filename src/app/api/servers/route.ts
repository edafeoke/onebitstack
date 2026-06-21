import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgPermissions } from "@/lib/auth/permissions";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const servers = await prisma.server.findMany({
    where: serversAccessibleWhere(session.user.id),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      host: true,
      sshUser: true,
      webStack: true,
      reverseProxyNotes: true,
      tlsCertPath: true,
      tlsKeyPath: true,
      reverseProxyConfigPath: true,
      deployRoot: true,
      organizationId: true,
      createdAt: true,
      _count: { select: { projects: true } }
    }
  });
  const rows = await Promise.all(
    servers.map(async (s) => {
      const perms = await getOrgPermissions(session.user.id, s.organizationId);
      return {
        id: s.id,
        name: s.name,
        host: s.host,
        sshUser: s.sshUser,
        webStack: s.webStack,
        reverseProxyNotes: s.reverseProxyNotes,
        tlsCertPath: s.tlsCertPath,
        tlsKeyPath: s.tlsKeyPath,
        reverseProxyConfigPath: s.reverseProxyConfigPath,
        deployRoot: s.deployRoot,
        createdAt: s.createdAt,
        projectCount: s._count.projects,
        canDestructive: perms.canDestructive,
        canManageServers: perms.canManageServers
      };
    })
  );
  return Response.json(rows);
}
