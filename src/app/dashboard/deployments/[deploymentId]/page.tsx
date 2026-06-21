"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DashboardPage } from "@/components/dashboard-page";
import { CancelDeploymentButton } from "@/components/cancel-deployment-button";
import { RollbackDeploymentButton } from "@/components/rollback-deployment-button";
import { ProjectDeployButton } from "@/app/dashboard/projects/[id]/project-deploy-button";
import { ColoredLogLine } from "@/components/colored-log-line";
import { LOG_CONSOLE_SCROLL_CLASS } from "@/lib/log-line-styles";

type LogLine = { seq: number; line: string };

type ApiDeployment = {
  status: string;
  kind?: string;
  projectId?: string;
  projectName?: string;
  canRollback?: boolean;
  canDestructive?: boolean;
  releasePath?: string | null;
  assignedPort?: number | null;
};

export default function DeploymentLogsPage() {
  const params = useParams();
  const deploymentId = params.deploymentId as string;
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<string | null>(null);
  const [meta, setMeta] = useState<ApiDeployment | null>(null);
  const [filter, setFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/deployments/${deploymentId}`, {
        credentials: "include"
      });
      if (res.ok) {
        const j = (await res.json()) as ApiDeployment;
        setApiStatus(j.status);
        setMeta(j);
      }
    })();
  }, [deploymentId]);

  useEffect(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const es = new EventSource(`${base}/api/deployments/${deploymentId}/logs`);

    es.addEventListener("line", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as LogLine;
      setLines((prev) => {
        if (prev.some((l) => l.seq === data.seq)) return prev;
        return [...prev, data].sort((a, b) => a.seq - b.seq);
      });
    });

    es.addEventListener("done", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { status: string };
      setStatus(data.status);
      es.close();
    });

    es.addEventListener("error", () => {
      es.close();
    });

    return () => es.close();
  }, [deploymentId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => l.line.toLowerCase().includes(q));
  }, [lines, filter]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [filtered, autoScroll, scrollToBottom]);

  const displayStatus = status ?? apiStatus;
  const canCancel =
    displayStatus === "queued" || displayStatus === "running";
  const canRollback =
    Boolean(meta?.canRollback) &&
    (displayStatus === "success" || displayStatus === "failed") &&
    meta?.kind !== "rollback";

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deployment logs</h1>
          <p className="text-muted-foreground font-mono text-xs">{deploymentId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {displayStatus ? (
            <Badge variant="secondary">{displayStatus}</Badge>
          ) : (
            <Badge>loading…</Badge>
          )}
          {canRollback ? (
            <RollbackDeploymentButton
              deploymentId={deploymentId}
              canDestructive={meta?.canDestructive ?? false}
            />
          ) : null}
          {meta?.projectId && !canCancel ? (
            <ProjectDeployButton
              projectId={meta.projectId}
              label="Redeploy"
              pendingLabel="Redeploying…"
              size="sm"
              showError={false}
              wrapperClassName="inline-flex"
            />
          ) : null}
          {canCancel ? (
            <CancelDeploymentButton
              deploymentId={deploymentId}
              variant="outline"
              onSuccess={async () => {
                const res = await fetch(`/api/deployments/${deploymentId}`, {
                  credentials: "include"
                });
                if (res.ok) {
                  const j = (await res.json()) as ApiDeployment;
                  setApiStatus(j.status);
                  setStatus(j.status);
                }
              }}
            />
          ) : null}
          <Link
            href="/dashboard/projects"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Back to projects
          </Link>
        </div>
      </div>
      {meta?.releasePath || meta?.assignedPort ? (
        <p className="text-muted-foreground font-mono text-xs">
          {meta.releasePath ? <>Release: {meta.releasePath}</> : null}
          {meta.releasePath && meta.assignedPort ? " · " : null}
          {meta.assignedPort ? <>Port: {meta.assignedPort}</> : null}
        </p>
      ) : null}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Console</CardTitle>
          <div className="flex max-w-md flex-1 flex-wrap items-center gap-2">
            <Input
              placeholder="Filter lines…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className={cn("h-[min(70vh,560px)]", LOG_CONSOLE_SCROLL_CLASS)}>
            {filtered.map((l) => (
              <ColoredLogLine key={l.seq} line={l.line} />
            ))}
            <div ref={bottomRef} />
          </ScrollArea>
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
