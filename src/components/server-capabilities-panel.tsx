"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { probeServerCapabilitiesAction } from "@/app/dashboard/servers/actions";
import { CAPABILITY_ROWS } from "@/lib/provision/capability-labels";
import type { ServerCapabilities } from "@/lib/provision/debian";
import { isRequiredCapabilitySatisfied } from "@/lib/provision/required";

function CapRow({
  label,
  ok,
  version,
  required
}: {
  label: string;
  ok: boolean;
  version?: string;
  required?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span>
        {label}
        {required ? <span className="text-muted-foreground ml-1 text-xs">(required)</span> : null}
      </span>
      <span className="text-muted-foreground shrink-0 text-right font-mono text-xs">
        {ok ? "✅" : "❌"}
        {version ? ` ${version}` : ""}
      </span>
    </div>
  );
}

export function ServerCapabilitiesPanel({
  serverId,
  capabilities,
  lastProbeAt
}: {
  serverId: string;
  capabilities: ServerCapabilities;
  lastProbeAt: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function probe() {
    setPending(true);
    const res = await probeServerCapabilitiesAction({ id: serverId });
    setPending(false);
    if (res.ok) {
      toast.success("Capabilities updated");
      router.refresh();
    } else {
      toast.error(res.message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>
            Last probe: {lastProbeAt ? new Date(lastProbeAt).toLocaleString() : "never"}
            {isRequiredCapabilitySatisfied(capabilities) ? (
              <span className="text-foreground"> · All required capabilities OK</span>
            ) : (
              <span> · Some required capabilities missing — provision or install on the VPS</span>
            )}
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void probe()}>
          {pending ? "Probing…" : "Probe"}
        </Button>
      </CardHeader>
      <CardContent>
        {CAPABILITY_ROWS.map(({ key, label, required }) => (
          <CapRow
            key={key}
            label={label}
            required={required}
            ok={Boolean(capabilities[key])}
            version={capabilities[key]}
          />
        ))}
      </CardContent>
    </Card>
  );
}
