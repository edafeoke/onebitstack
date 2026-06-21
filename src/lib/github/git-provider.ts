/**
 * Git provider connections for Central Server.
 *
 * We model GitHub via:
 * - `Account` (better-auth) — user OAuth link to GitHub
 * - `GitHubAppInstallation` — org/user workspace installations
 * - `Project.githubInstallationId` — which installation deploys a repo
 *
 * A dedicated `GitProviderConnection` table is optional; use these helpers until
 * multi-provider (GitLab, etc.) is required.
 */

import { prisma } from "@/lib/prisma";
import { installationsAccessibleWhere } from "@/lib/organization/access";

export type GitProviderKind = "github";

export type GitProviderConnectionView = {
  provider: GitProviderKind;
  installationId: string;
  accountLogin: string;
  accountType: string;
  suspended: boolean;
  organizationName: string;
  organizationSlug: string;
};

export async function listGitProviderConnectionsForUser(
  userId: string
): Promise<GitProviderConnectionView[]> {
  const rows = await prisma.gitHubAppInstallation.findMany({
    where: installationsAccessibleWhere(userId),
    orderBy: { createdAt: "desc" },
    select: {
      installationId: true,
      accountLogin: true,
      accountType: true,
      suspended: true,
      organization: { select: { name: true, slug: true } }
    }
  });

  return rows.map((r) => ({
    provider: "github" as const,
    installationId: r.installationId,
    accountLogin: r.accountLogin,
    accountType: r.accountType,
    suspended: r.suspended,
    organizationName: r.organization.name,
    organizationSlug: r.organization.slug
  }));
}

export async function userHasGithubAccount(userId: string): Promise<boolean> {
  const row = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
    select: { id: true }
  });
  return row != null;
}
