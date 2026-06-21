"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  canManageMembers,
  isPlatformAdmin,
  PERMISSION_DENIED_DESTRUCTIVE
} from "@/lib/auth/permissions";
import { isOrgRole, ORG_ROLES, type OrgRole } from "@/lib/auth/roles";
import { userCanAccessOrganization } from "@/lib/organization/access";
import { wouldRemoveLastOwner } from "@/lib/organization/member-guards";
import { prisma } from "@/lib/prisma";

const orgSlugSchema = z.object({ organizationSlug: z.string().min(1).max(128) });

const updateRoleSchema = z.object({
  organizationSlug: z.string().min(1).max(128),
  userId: z.string().min(1),
  role: z.enum(ORG_ROLES)
});

const removeSchema = z.object({
  organizationSlug: z.string().min(1).max(128),
  userId: z.string().min(1)
});

const addSchema = z.object({
  organizationSlug: z.string().min(1).max(128),
  email: z.string().email().max(320),
  role: z.enum(ORG_ROLES).default("developer")
});

async function resolveOrganizationForManage(
  actorId: string,
  organizationSlug: string
): Promise<{ ok: true; organizationId: string } | { ok: false; message: string }> {
  const org = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    select: { id: true }
  });
  if (!org) return { ok: false, message: "Workspace not found." };

  const platformAdmin = await isPlatformAdmin(actorId);
  const canAccess =
    platformAdmin || (await userCanAccessOrganization(actorId, org.id));
  if (!canAccess) return { ok: false, message: "Workspace not found." };

  if (!(await canManageMembers(actorId, org.id))) {
    return { ok: false, message: PERMISSION_DENIED_DESTRUCTIVE };
  }

  return { ok: true, organizationId: org.id };
}

export async function updateOrganizationMemberRoleAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const ctx = await resolveOrganizationForManage(
    session.user.id,
    parsed.data.organizationSlug
  );
  if (!ctx.ok) return ctx;

  const nextRole = parsed.data.role as OrgRole;
  if (!isOrgRole(nextRole)) return { ok: false, message: "Invalid role." };

  if (
    await wouldRemoveLastOwner(ctx.organizationId, parsed.data.userId, nextRole)
  ) {
    return {
      ok: false,
      message: "This workspace must keep at least one owner. Promote another member first."
    };
  }

  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: ctx.organizationId,
        userId: parsed.data.userId
      }
    }
  });
  if (!member) return { ok: false, message: "Member not found." };

  await prisma.organizationMember.update({
    where: {
      organizationId_userId: {
        organizationId: ctx.organizationId,
        userId: parsed.data.userId
      }
    },
    data: { role: nextRole }
  });

  revalidatePath("/dashboard/settings/members");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function removeOrganizationMemberAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const ctx = await resolveOrganizationForManage(
    session.user.id,
    parsed.data.organizationSlug
  );
  if (!ctx.ok) return ctx;

  if (parsed.data.userId === session.user.id) {
    return { ok: false, message: "You cannot remove yourself. Ask another owner or admin." };
  }

  if (await wouldRemoveLastOwner(ctx.organizationId, parsed.data.userId)) {
    return {
      ok: false,
      message: "Cannot remove the only owner. Promote another member to owner first."
    };
  }

  const deleted = await prisma.organizationMember.deleteMany({
    where: {
      organizationId: ctx.organizationId,
      userId: parsed.data.userId
    }
  });
  if (deleted.count === 0) return { ok: false, message: "Member not found." };

  revalidatePath("/dashboard/settings/members");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function addOrganizationMemberByEmailAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { ok: false, message: "Unauthorized" };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const ctx = await resolveOrganizationForManage(
    session.user.id,
    parsed.data.organizationSlug
  );
  if (!ctx.ok) return ctx;

  const role = parsed.data.role as OrgRole;
  if (role === "owner") {
    return { ok: false, message: "Add members as admin, developer, or viewer; promote to owner separately." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, name: true, email: true }
  });
  if (!user) {
    return {
      ok: false,
      message:
        "No user with that email. They must sign in to Central with GitHub first, then you can add them."
    };
  }

  const existing = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: ctx.organizationId, userId: user.id }
    }
  });
  if (existing) {
    return { ok: false, message: "That user is already in this workspace." };
  }

  await prisma.organizationMember.create({
    data: {
      organizationId: ctx.organizationId,
      userId: user.id,
      role
    }
  });

  revalidatePath("/dashboard/settings/members");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
