"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  disconnectAgentAction,
  generateAgentPairingTokenAction
} from "@/app/dashboard/servers/server-agent-actions";

const HEARTBEAT_STALE_MS = 90_000;

function agentOnline(agentStatus: string, lastAgentHeartbeatAt: string | null): boolean {
  if (agentStatus !== "connected") return false;
  if (!lastAgentHeartbeatAt) return false;
  return Date.now() - new Date(lastAgentHeartbeatAt).getTime() < HEARTBEAT_STALE_MS;
}

export function ServerAgentPanel({
  serverId,
  serverHost,
  agentStatus,
  lastAgentHeartbeatAt,
  agentVersion,
  canManage
}: {
  serverId: string;
  serverHost: string;
  agentStatus: string;
  lastAgentHeartbeatAt: string | null;
  agentVersion: string | null;
  canManage: boolean;
}) {
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const online = agentOnline(agentStatus, lastAgentHeartbeatAt);

  const apiBase =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  async function generateToken() {
    setPending(true);
    const res = await generateAgentPairingTokenAction({ serverId });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setPairingToken(res.token);
    toast.success("Pairing token generated (15 min)");
  }

  async function disconnect() {
    setPending(true);
    const res = await disconnectAgentAction({ serverId });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setPairingToken(null);
    toast.success("Agent disconnected");
  }

  const pairCmd = pairingToken
    ? `npx tsx packages/central-agent/src/cli.ts pair --url ${apiBase} --token ${pairingToken}`
    : null;

  const runCmd = `npx tsx packages/central-agent/src/cli.ts run --url ${apiBase}`;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            online ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
          }
        >
          Agent: {online ? "connected" : agentStatus}
        </span>
        {agentVersion ? (
          <span className="text-muted-foreground text-xs">v{agentVersion}</span>
        ) : null}
        {lastAgentHeartbeatAt ? (
          <span className="text-muted-foreground text-xs">
            heartbeat {new Date(lastAgentHeartbeatAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Install the agent on <span className="font-mono">{serverHost}</span> to run builds locally
        without SSH from Central. Nginx/PM2 may still use SSH briefly after the agent build.
      </p>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void generateToken()}
          >
            {pairingToken ? "Regenerate pairing token" : "Generate pairing token"}
          </Button>
          {agentStatus === "connected" ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => void disconnect()}
            >
              Disconnect agent
            </Button>
          ) : null}
        </div>
      ) : null}
      {pairCmd ? (
        <div className="space-y-1 rounded-md border p-3">
          <p className="font-medium">1. Pair (once, on the VPS)</p>
          <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">{pairCmd}</pre>
        </div>
      ) : null}
      {(agentStatus === "connected" || pairingToken) && (
        <div className="space-y-1 rounded-md border p-3">
          <p className="font-medium">2. Run agent (on the VPS)</p>
          <pre className="bg-muted overflow-x-auto rounded p-2 text-xs">{runCmd}</pre>
        </div>
      )}
    </div>
  );
}
