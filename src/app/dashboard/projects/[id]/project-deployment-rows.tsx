"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CancelDeploymentButton } from "@/components/cancel-deployment-button";

export function ProjectDeploymentRows({
  deployments
}: {
  deployments: { id: string; status: string }[];
}) {
  return (
    <div className="space-y-3">
      {deployments.map((d) => (
        <div
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0"
        >
          <span className="capitalize">{d.status}</span>
          <div className="flex flex-wrap items-center gap-2">
            {d.status === "queued" || d.status === "running" ? (
              <CancelDeploymentButton deploymentId={d.id} variant="outline" />
            ) : null}
            <Link
              href={`/dashboard/deployments/${d.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Logs
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
