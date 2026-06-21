"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavDocuments({
  items,
  label = "Documents",
}: {
  items: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
  label?: string
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active =
            pathname === item.url ||
            (item.url !== "/dashboard/deployments" && pathname.startsWith(item.url)) ||
            (item.url === "/dashboard/deployments" &&
              pathname.startsWith("/dashboard/deployments"))
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                isActive={active}
                render={<Link href={item.url} />}
              >
                {item.icon}
                <span>{item.name}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
