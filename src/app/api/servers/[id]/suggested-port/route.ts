import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { buildDeployTarget } from "@/lib/deploy/deploy-target";
import { suggestNextAppPort } from "@/lib/port-allocation";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const server = await prisma.server.findFirst({
    where: { id, ...serversAccessibleWhere(session.user.id) }
  });
  if (!server) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const port = await suggestNextAppPort(server.id, {
    remoteTarget: buildDeployTarget(server, "/tmp")
  });
  return Response.json({ port });
}
