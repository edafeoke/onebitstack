"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { provisionServerAction } from "@/app/dashboard/servers/actions";
import { REQUIRED_PROVISION_FLAGS } from "@/lib/provision/required";
import type { ProvisionFlags } from "@/lib/provision/debian";

const PROVISION_OPTIONS: { key: keyof ProvisionFlags; label: string; required?: boolean }[] = [
  { key: "git", label: "Git", required: true },
  { key: "nginx", label: "nginx", required: true },
  { key: "node", label: "Node.js LTS", required: true },
  { key: "pm2", label: "PM2", required: true },
  { key: "php", label: "PHP-FPM + Composer + SQLite", required: true },
  { key: "python", label: "Python 3" },
  { key: "apache", label: "Apache" },
  { key: "docker", label: "Docker" },
  { key: "bun", label: "Bun" }
];

export function ServerOpsPanel({
  serverId,
  canDestructive = true
}: {
  serverId: string;
  canDestructive?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [flags, setFlags] = useState<ProvisionFlags>({ ...REQUIRED_PROVISION_FLAGS });

  function setFlag(key: keyof ProvisionFlags, value: boolean) {
    setFlags((prev) => ({ ...prev, [key]: value }));
  }

  function selectAllRequired() {
    setFlags({ ...REQUIRED_PROVISION_FLAGS });
  }

  async function runProvision() {
    setPending(true);
    const res = await provisionServerAction({ id: serverId, ...flags });
    setPending(false);
    if (res.ok) {
      toast.success("Provisioning started");
      router.push(`/dashboard/servers/${serverId}?run=${res.runId}`);
    } else toast.error(res.message);
    router.refresh();
  }

  if (!canDestructive) {
    return (
      <p className="text-muted-foreground text-sm">
        Workspace owners and admins can run provisioning on this server.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Provision (Debian/Ubuntu)</div>
        <Button type="button" variant="outline" size="sm" onClick={selectAllRequired}>
          All required
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Required for Node/Next and Laravel: git, nginx, Node, PM2, PHP (includes php8.x-sqlite3 and
        Composer).
      </p>
      <div className="grid gap-2 text-sm">
        {PROVISION_OPTIONS.map(({ key, label, required }) => (
          <label key={key} className="flex gap-2">
            <input
              type="checkbox"
              checked={flags[key]}
              onChange={(e) => setFlag(key, e.target.checked)}
            />
            <span>
              {label}
              {required ? <span className="text-muted-foreground"> (required)</span> : null}
            </span>
          </label>
        ))}
      </div>
      <Button type="button" disabled={pending} onClick={() => void runProvision()}>
        Run provisioning
      </Button>
    </div>
  );
}
