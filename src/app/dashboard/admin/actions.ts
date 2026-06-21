"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isUserRole, USER_ROLES } from "@/lib/auth/roles";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

const updateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(USER_ROLES)
});

export async function updateUserRoleAction(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Unauthorized" };
  }
  if (!(await isPlatformAdmin(session.user.id))) {
    return { ok: false, message: "Platform admin required." };
  }

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  if (parsed.data.userId === session.user.id && parsed.data.role !== "admin") {
    return { ok: false, message: "You cannot demote your own platform admin account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true }
  });
  if (!target) {
    return { ok: false, message: "User not found." };
  }

  if (!isUserRole(parsed.data.role)) {
    return { ok: false, message: "Invalid role." };
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role }
  });

  revalidatePath("/dashboard/admin/users");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
