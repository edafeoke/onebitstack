import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { installationsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.gitHubAppInstallation.findMany({
    where: installationsAccessibleWhere(session.user.id),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      installationId: true,
      accountLogin: true,
      accountType: true,
      suspended: true,
      createdAt: true
    }
  });

  return Response.json(rows);
}
