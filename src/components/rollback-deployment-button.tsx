"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rollbackDeploymentAction } from "@/app/dashboard/projects/project-infra-actions";

export function RollbackDeploymentButton({
  deploymentId,
  disabled,
  canDestructive = true
}: {
  deploymentId: string;
  disabled?: boolean;
  canDestructive?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function rollback() {
    if (!confirm("Roll back to the previous successful release? This will repoint the live symlink and reload PM2/proxy.")) {
      return;
    }
    setPending(true);
    try {
      const res = await rollbackDeploymentAction({ deploymentId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Rollback queued");
      router.push(`/dashboard/deployments/${res.deploymentId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setPending(false);
    }
  }

  if (!canDestructive) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() => void rollback()}
    >
      {pending ? "Rolling back…" : "Rollback to previous"}
    </Button>
  );
}
