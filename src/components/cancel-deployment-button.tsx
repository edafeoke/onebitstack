"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelDeploymentAction } from "@/app/dashboard/deployments/actions";

export function CancelDeploymentButton({
  deploymentId,
  variant = "destructive",
  onSuccess
}: {
  deploymentId: string;
  variant?: "destructive" | "outline";
  onSuccess?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onCancel() {
    setMessage(null);
    startTransition(async () => {
      const res = await cancelDeploymentAction(deploymentId);
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      await onSuccess?.();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => onCancel()}
      >
        {pending ? "Cancelling…" : "Cancel deployment"}
      </Button>
      {message ? <p className="text-destructive max-w-xs text-right text-xs">{message}</p> : null}
    </div>
  );
}
