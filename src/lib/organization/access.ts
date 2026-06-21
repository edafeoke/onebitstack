import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Prisma filter: resources in any workspace the user belongs to. */
export function organizationMemberFilter(userId: string): {
  organization: { members: { some: { userId: string } } };
} {
  return { organization: { members: { some: { userId } } } };
}

export function projectsAccessibleWhere(userId: string): Prisma.ProjectWhereInput {
  return organizationMemberFilter(userId);
}

export function serversAccessibleWhere(userId: string): Prisma.ServerWhereInput {
  return organizationMemberFilter(userId);
}

export function installationsAccessibleWhere(
  userId: string
): Prisma.GitHubAppInstallationWhereInput {
  return organizationMemberFilter(userId);
}

export async function getOrganizationIdsForUser(userId: string): Promise<string[]> {
  const rows = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true }
  });
  return rows.map((r) => r.organizationId);
}

export async function userCanAccessOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const row = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } }
  });
  return row != null;
}

/**
 * Workspace for new servers/projects: prefer a GitHub org the user belongs to,
 * otherwise their personal workspace.
 */
export async function getDefaultOrganizationIdForUser(userId: string): Promise<string> {
  const orgMembership = await prisma.organizationMember.findFirst({
    where: { userId, organization: { kind: "organization" } },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true }
  });
  if (orgMembership) return orgMembership.organizationId;

  const personal = await prisma.organizationMember.findFirst({
    where: { userId, organization: { kind: "user" } },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true }
  });
  if (personal) return personal.organizationId;

  const { organizationId } = await ensurePersonalOrganization(userId);
  return organizationId;
}

export async function ensurePersonalOrganization(
  userId: string
): Promise<{ organizationId: string; slug: string }> {
  const existing = await prisma.organizationMember.findFirst({
    where: { userId, organization: { kind: "user" } },
    select: { organizationId: true, organization: { select: { slug: true } } }
  });
  if (existing) {
    return { organizationId: existing.organizationId, slug: existing.organization.slug };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });
  if (!user) throw new Error("User not found");

  const slug = `user-${userId}`;
  const name = user.name?.trim() || user.email;

  const org = await prisma.organization.upsert({
    where: { slug },
    create: {
      slug,
      name,
      githubId: null,
      kind: "user"
    },
    update: { name }
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId } },
    create: { organizationId: org.id, userId, role: "owner" },
    update: {}
  });

  return { organizationId: org.id, slug: org.slug };
}
