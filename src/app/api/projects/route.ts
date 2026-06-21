import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: projectsAccessibleWhere(session.user.id),
    orderBy: { updatedAt: "desc" },
    include: {
      server: { select: { id: true, name: true, host: true } },
      environments: true,
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true, commitHash: true }
      }
    }
  });

  return Response.json(projects);
}
