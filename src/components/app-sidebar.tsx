"use client";

import Link from "next/link";
import {
  FolderGit2,
  LayoutDashboard,
  ScrollText,
  Server,
  ServerIcon,
  Shield
} from "lucide-react";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { getPublicAppName } from "@/lib/app-config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";

const appName = getPublicAppName();

const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboard />
  },
  {
    title: "Projects",
    url: "/dashboard/projects",
    icon: <FolderGit2 />
  },
  {
    title: "Servers",
    url: "/dashboard/servers",
    icon: <Server />
  }
];

const navDeploy = [
  {
    name: "New project",
    url: "/dashboard/projects/new",
    icon: <FolderGit2 />
  },
  {
    name: "Deployment logs",
    url: "/dashboard/deployments",
    icon: <ScrollText />
  }
];

const navSecondary: {
  title: string;
  url: string;
  icon: React.ReactNode;
}[] = [
  // {
  //   title: "Settings",
  //   url: "/dashboard/settings",
  //   icon: <Settings2 />
  // }
];

export function AppSidebar({
  user,
  showAdminNav = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; image?: string | null };
  showAdminNav?: boolean;
}) {
  const mainNav = showAdminNav
    ? [
        ...navMain,
        {
          title: "Admin",
          url: "/dashboard/admin",
          icon: <Shield />
        }
      ]
    : navMain;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <ServerIcon className="size-5!" />
              <span className="text-base font-semibold">{appName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNav} quickCreateHref="/dashboard/projects/new" />
        <NavDocuments items={navDeploy} label="Deploy" />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user.name,
            email: user.email,
            avatar: user.image ?? ""
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
