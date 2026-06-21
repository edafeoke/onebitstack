import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { installationsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { listInstallationRepositories } from "@/lib/github/github-rest";
import { getInstallationAccessToken } from "@/lib/github-app/installation-token";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ installationId: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { installationId } = await ctx.params;
  const row = await prisma.gitHubAppInstallation.findFirst({
    where: { installationId, suspended: false, ...installationsAccessibleWhere(session.user.id) }
  });
  if (!row) {
    return Response.json({ error: "Installation not found" }, { status: 404 });
  }

  try {
    const token = await getInstallationAccessToken(installationId);
    const repos = await listInstallationRepositories(token);
    return Response.json(
      repos.map((r) => ({
        fullName: r.full_name,
        defaultBranch: r.default_branch,
        private: r.private
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 502 });
  }
}
