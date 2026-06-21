import { prisma } from "@/lib/prisma";
import { isUserRole, normalizeOrgRole, type OrgRole, type UserRole } from "@/lib/auth/roles";

const DESTRUCTIVE_ROLES: OrgRole[] = ["owner", "admin"];
const DEPLOY_ROLES: OrgRole[] = ["owner", "admin", "developer"];
const SERVER_MANAGE_ROLES: OrgRole[] = ["owner", "admin"];
const MEMBER_MANAGE_ROLES: OrgRole[] = ["owner", "admin"];

export async function getUserRole(userId: string): Promise<UserRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  const role = user?.role ?? "user";
  return isUserRole(role) ? role : "user";
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  return (await getUserRole(userId)) === "admin";
}

export async function getOrganizationMemberRole(
  userId: string,
  organizationId: string
): Promise<OrgRole | null> {
  const row = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true }
  });
  if (!row) return null;
  return normalizeOrgRole(row.role);
}

async function hasOrgRole(
  userId: string,
  organizationId: string,
  allowed: readonly OrgRole[]
): Promise<boolean> {
  if (await isPlatformAdmin(userId)) return true;
  const role = await getOrganizationMemberRole(userId, organizationId);
  return role != null && allowed.includes(role);
}

export async function canPerformDestructiveOps(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return hasOrgRole(userId, organizationId, DESTRUCTIVE_ROLES);
}

export async function canDeploy(userId: string, organizationId: string): Promise<boolean> {
  return hasOrgRole(userId, organizationId, DEPLOY_ROLES);
}

export async function canWriteProject(userId: string, organizationId: string): Promise<boolean> {
  return hasOrgRole(userId, organizationId, DEPLOY_ROLES);
}

export async function canManageServers(userId: string, organizationId: string): Promise<boolean> {
  return hasOrgRole(userId, organizationId, SERVER_MANAGE_ROLES);
}

export async function canManageMembers(userId: string, organizationId: string): Promise<boolean> {
  return hasOrgRole(userId, organizationId, MEMBER_MANAGE_ROLES);
}

export type OrgPermissions = {
  role: OrgRole | null;
  canDestructive: boolean;
  canDeploy: boolean;
  canWriteProject: boolean;
  canManageServers: boolean;
  canManageMembers: boolean;
};

export async function getOrgPermissions(
  userId: string,
  organizationId: string
): Promise<OrgPermissions> {
  const platformAdmin = await isPlatformAdmin(userId);
  const role = await getOrganizationMemberRole(userId, organizationId);
  if (platformAdmin) {
    return {
      role,
      canDestructive: true,
      canDeploy: true,
      canWriteProject: true,
      canManageServers: true,
      canManageMembers: true
    };
  }
  return {
    role,
    canDestructive: role != null && DESTRUCTIVE_ROLES.includes(role),
    canDeploy: role != null && DEPLOY_ROLES.includes(role),
    canWriteProject: role != null && DEPLOY_ROLES.includes(role),
    canManageServers: role != null && SERVER_MANAGE_ROLES.includes(role),
    canManageMembers: role != null && MEMBER_MANAGE_ROLES.includes(role)
  };
}

export const PERMISSION_DENIED_DESTRUCTIVE =
  "Only workspace owners and admins can perform this action.";
export const PERMISSION_DENIED_DEPLOY =
  "You do not have permission to deploy in this workspace.";
export const PERMISSION_DENIED_SERVERS =
  "Only workspace owners and admins can manage servers.";
