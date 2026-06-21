import type { ReactNode } from "react";
import { after } from "next/server";
import { AppProviders } from "@/components/app-providers";
import { DashboardShell } from "@/components/dashboard-shell";
import { GithubOAuthBanner } from "@/components/github-oauth-banner";
import { provisionTenantForUser } from "@/lib/organization/provision-tenant";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const showAdminNav = await isPlatformAdmin(session.user.id);

  after(async () => {
    try {
      await provisionTenantForUser(session.user.id);
    } catch (e) {
      console.warn("[organization] membership sync failed:", e);
    }
  });

  return (
    <AppProviders>
      <DashboardShell
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        }}
        showAdminNav={showAdminNav}
      >
        <GithubOAuthBanner />
        {children}
      </DashboardShell>
    </AppProviders>
  );
}
