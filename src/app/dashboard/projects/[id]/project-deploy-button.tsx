"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { messageFromApiBody } from "@/lib/api-response";
import { cn } from "@/lib/utils";

export function ProjectDeployButton({
  projectId,
  label = "Deploy",
  pendingLabel = "Deploying…",
  variant = "default",
  size,
  wrapperClassName,
  showError = true
}: {
  projectId: string;
  label?: string;
  pendingLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  wrapperClassName?: string;
  showError?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deploy() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      });
      const body = (await res.json().catch(() => ({}))) as {
        deploymentId?: string;
        error?: unknown;
      };
      if (!res.ok) {
        throw new Error(messageFromApiBody(body, "Deploy failed"));
      }
      if (body.deploymentId) {
        toast.success("Deployment queued");
        router.push(`/dashboard/deployments/${body.deploymentId}`);
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deploy failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", wrapperClassName)}>
      <Button variant={variant} size={size} onClick={() => void deploy()} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {showError && error ? (
        <p className="text-destructive max-w-xs text-right text-xs">{error}</p>
      ) : null}
    </div>
  );
}
