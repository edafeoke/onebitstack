import { prisma } from "@/lib/prisma";
import { normalizeOrgRole, type OrgRole } from "@/lib/auth/roles";

const OWNER_ROLE: OrgRole = "owner";

export async function countOrganizationOwners(organizationId: string): Promise<number> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    select: { role: true }
  });
  return members.filter((m) => normalizeOrgRole(m.role) === OWNER_ROLE).length;
}

export async function wouldRemoveLastOwner(
  organizationId: string,
  targetUserId: string,
  nextRole?: OrgRole
): Promise<boolean> {
  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    select: { role: true }
  });
  if (!target || normalizeOrgRole(target.role) !== OWNER_ROLE) return false;

  const owners = await countOrganizationOwners(organizationId);
  if (owners > 1) return false;

  if (nextRole != null && nextRole !== OWNER_ROLE) return true;
  return nextRole == null;
}
