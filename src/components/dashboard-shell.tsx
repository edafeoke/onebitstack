"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const sidebarStyle = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)"
} as React.CSSProperties;

export function DashboardShell({
  children,
  user,
  showAdminNav = false
}: {
  children: React.ReactNode;
  user: { name: string; email: string; image?: string | null };
  showAdminNav?: boolean;
}) {
  return (
    <SidebarProvider style={sidebarStyle}>
      <AppSidebar variant="inset" user={user} showAdminNav={showAdminNav} />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2 px-4 lg:px-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
