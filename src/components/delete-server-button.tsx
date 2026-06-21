"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteServerAction } from "@/app/dashboard/servers/actions";

export function DeleteServerButton({
  serverId,
  serverName,
  projectCount,
  size = "default",
  canDestructive = true
}: {
  serverId: string;
  serverName: string;
  projectCount: number;
  size?: "default" | "sm";
  canDestructive?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const blocked = projectCount > 0;

  if (!canDestructive) return null;

  function reset() {
    setOpen(false);
    setConfirmName("");
    setMessage(null);
  }

  function onDelete() {
    setMessage(null);
    startTransition(async () => {
      const res = await deleteServerAction({ id: serverId, confirmName });
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      reset();
      router.push("/dashboard/servers");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="destructive"
        size={size}
        disabled={blocked}
        title={
          blocked
            ? "Delete all projects using this server before removing it."
            : undefined
        }
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <div className="border-destructive/50 bg-destructive/5 space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">Delete this server?</p>
      <p className="text-muted-foreground text-xs">
        The encrypted SSH key will be removed. This cannot be undone.
      </p>
      <div className="space-y-2">
        <Label htmlFor={`confirm-server-${serverId}`}>Type the server display name to confirm</Label>
        <Input
          id={`confirm-server-${serverId}`}
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={serverName}
          autoComplete="off"
        />
      </div>
      {message ? <p className="text-destructive text-xs">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => onDelete()}>
          {pending ? "Deleting…" : "Delete permanently"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => reset()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
