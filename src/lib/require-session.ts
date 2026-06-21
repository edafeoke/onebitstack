import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isUserRole, type UserRole } from "@/lib/auth/roles";
import { isPlatformAdmin } from "@/lib/auth/permissions";

type AppSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type SessionUser = AppSession["user"] & { role?: string };

export async function getSession(): Promise<AppSession | null> {
  return auth.api.getSession({ headers: await headers() });
}

export function getSessionUserRole(session: AppSession): UserRole {
  const role = (session.user as SessionUser).role ?? "user";
  return isUserRole(role) ? role : "user";
}

/** Redirects to login when there is no valid session. Use in server layouts/pages. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/** Redirects non-platform admins to the main dashboard. */
export async function requirePlatformAdmin(): Promise<AppSession> {
  const session = await requireSession();
  if (!(await isPlatformAdmin(session.user.id))) {
    redirect("/dashboard");
  }
  return session;
}
