"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/projects": "Projects",
  "/dashboard/projects/new": "New project",
  "/dashboard/servers": "Servers",
  "/login": "Sign in",
  "/signup": "Sign up",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/members": "Workspace members",
  "/dashboard/admin": "Platform admin",
  "/dashboard/admin/users": "Users",
  "/dashboard/admin/organizations": "Organizations"
};

function titleForPath(pathname: string): string {
  if (titles[pathname]) return titles[pathname];
  if (pathname.startsWith("/dashboard/deployments/")) return "Deployment logs";
  if (pathname.startsWith("/dashboard/projects/")) return "Project";
  if (pathname.startsWith("/dashboard/servers/")) return "Server";
  return "Dashboard";
}

export function SiteHeader() {
  const pathname = usePathname();
  const title = titleForPath(pathname);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
        <h1 className="text-base font-medium">{title}</h1>
      </div>
    </header>
  );
}
