"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SyncGithubInstallationsButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/github/installations/sync", {
        method: "POST",
        credentials: "include"
      });
      const data = (await res.json()) as {
        ok?: boolean;
        synced?: number;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setMessage(data.message ?? `Sync failed (${res.status})`);
        return;
      }
      setMessage(
        data.synced === 0
          ? "No installations found on GitHub for this app."
          : `Linked ${data.synced} installation(s).`
      );
      router.refresh();
    } catch {
      setMessage("Sync failed. Check the network and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void sync()}
      >
        {pending ? "Syncing…" : "Sync installations from GitHub"}
      </Button>
      {message ? <p className="text-muted-foreground text-xs">{message}</p> : null}
    </div>
  );
}
