"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { deleteProjectAction } from "@/app/dashboard/projects/actions";

export function DeleteProjectButton({
  projectId,
  projectName,
  variant = "detail",
  canDestructive = true
}: {
  projectId: string;
  projectName: string;
  variant?: "detail" | "table";
  canDestructive?: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [details, setDetails] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const nameMatches = confirmName.trim() === projectName;

  if (!canDestructive) return null;

  function reset() {
    setConfirmName("");
    setMessage(null);
    setDetails(null);
  }

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) reset();
  }

  function onDelete() {
    setMessage(null);
    setDetails(null);
    startTransition(async () => {
      const res = await deleteProjectAction({ id: projectId, confirmName });
      if (!res.ok) {
        setMessage(res.message);
        setDetails(res.details ?? null);
        return;
      }
      setOpen(false);
      reset();
      await qc.invalidateQueries({ queryKey: ["projects"] });
      router.refresh();
      if (variant === "detail") {
        router.push("/dashboard/projects");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="destructive"
        size={variant === "table" ? "sm" : "default"}
        onClick={() => setOpen(true)}
      >
        Delete project
      </Button>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TriangleAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete project permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes <span className="font-medium text-foreground">{projectName}</span> from
            Central and cleans up the server: nginx or PM2 site, the project&apos;s deployment path,
            logs, and database. The project is only deleted after server cleanup succeeds.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3 px-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`confirm-${projectId}`}>Type the project name to confirm</Label>
            <Input
              id={`confirm-${projectId}`}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projectName}
              autoComplete="off"
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameMatches && !pending) onDelete();
              }}
            />
          </div>
          {message ? <p className="text-destructive text-sm">{message}</p> : null}
          {details && details.length > 0 ? (
            <pre className="bg-muted max-h-40 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap">
              {details.join("\n")}
            </pre>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !nameMatches}
            onClick={() => onDelete()}
          >
            {pending ? "Cleaning server…" : "Delete permanently"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
