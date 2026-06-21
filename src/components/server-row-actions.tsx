"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DeleteServerButton } from "@/components/delete-server-button";

export function ServerRowActions({
  serverId,
  serverName,
  projectCount
}: {
  serverId: string;
  serverName: string;
  projectCount: number;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/dashboard/servers/${serverId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        View
      </Link>
      <Link href={`/dashboard/servers/${serverId}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Edit
      </Link>
      <DeleteServerButton serverId={serverId} serverName={serverName} projectCount={projectCount} size="sm" />
    </div>
  );
}
