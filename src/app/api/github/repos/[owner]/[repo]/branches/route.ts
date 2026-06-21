import { headers } from "next/headers";
import { apiError, apiOk } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { installationsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { listBranches } from "@/lib/github/github-rest";
import { getInstallationAccessToken } from "@/lib/github-app/installation-token";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ owner: string; repo: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installationId")?.trim();
  if (!installationId) {
    return apiError("Missing installationId", 400, "VALIDATION_ERROR");
  }

  const row = await prisma.gitHubAppInstallation.findFirst({
    where: { installationId, suspended: false, ...installationsAccessibleWhere(session.user.id) }
  });
  if (!row) {
    return apiError("Installation not found", 404, "NOT_FOUND");
  }

  const { owner, repo } = await ctx.params;
  if (!owner || !repo) {
    return apiError("Invalid path", 400, "VALIDATION_ERROR");
  }

  try {
    const token = await getInstallationAccessToken(installationId);
    let branches = await listBranches(token, decodeURIComponent(owner), decodeURIComponent(repo));
    const q = searchParams.get("q")?.trim().toLowerCase();
    if (q) {
      branches = branches.filter((b) => b.name.toLowerCase().includes(q));
    }
    return apiOk(branches);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(msg, 502, "GITHUB_ERROR");
  }
}
