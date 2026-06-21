"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";

function isNavActive(pathname: string, url: string) {
  if (url === "/dashboard") return pathname === "/dashboard";
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function NavMain({
  items,
  quickCreateHref = "/dashboard/projects/new"
}: {
  items: { title: string; url: string; icon?: React.ReactNode }[];
  quickCreateHref?: string;
}) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="New project"
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              render={<Link href={quickCreateHref} />}
            >
              <CirclePlus />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
              render={<Link href="/dashboard/settings" />}
            >
              <Settings2 />
              <span className="sr-only">Settings</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={isNavActive(pathname, item.url)}
                render={<Link href={item.url} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
