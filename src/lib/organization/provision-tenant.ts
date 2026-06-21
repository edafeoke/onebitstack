import { ensurePersonalOrganization } from "@/lib/organization/access";
import { syncGithubMembershipsForUser } from "@/lib/organization/sync-memberships";
import { prisma } from "@/lib/prisma";

/** Ensure every signed-in user has a workspace; sync GitHub orgs when linked. */
export async function provisionTenantForUser(userId: string): Promise<void> {
  await ensurePersonalOrganization(userId);

  const github = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "github",
      accessToken: { not: null }
    },
    select: { accessToken: true }
  });
  if (!github?.accessToken?.trim()) return;

  await syncGithubMembershipsForUser(userId);
}
