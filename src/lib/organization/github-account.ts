import type { OrgRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export type GithubAccountRef = {
  login: string;
  type: string;
  githubId?: string | null;
};

function normalizeKind(accountType: string): "organization" | "user" {
  return accountType === "Organization" ? "organization" : "user";
}

export function organizationSlugForGithubAccount(login: string): string {
  return login.trim().toLowerCase();
}

/**
 * Upsert a workspace for a GitHub user or organization account.
 */
export async function upsertOrganizationFromGithubAccount(
  account: GithubAccountRef
): Promise<{ organizationId: string; slug: string; kind: string }> {
  const slug = organizationSlugForGithubAccount(account.login);
  const kind = normalizeKind(account.type);
  const org = await prisma.organization.upsert({
    where: { slug },
    create: {
      slug,
      name: account.login,
      githubId: account.githubId ?? null,
      kind
    },
    update: {
      name: account.login,
      kind,
      ...(account.githubId ? { githubId: account.githubId } : {})
    }
  });
  return { organizationId: org.id, slug: org.slug, kind: org.kind };
}

export async function ensureOrganizationMembership(
  userId: string,
  organizationId: string,
  role: OrgRole = "developer"
): Promise<void> {
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId, role },
    update: {}
  });
}
