"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Metrics = {
  collectedAt: string;
  uptime: string;
  load1: number;
  load5: number;
  load15: number;
  cpuCount: number;
  memTotalMb: number;
  memUsedMb: number;
  memUsedPct: number;
  diskUsedPct: number;
  diskAvail: string;
  diskMount: string;
  tcpEstablished?: number;
};

export function ServerMetricsPanel({ serverId }: { serverId: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(live: boolean) {
      try {
        const res = await fetch(
          `/api/servers/${encodeURIComponent(serverId)}/metrics?${live ? "live=1" : ""}`,
          { credentials: "include" }
        );
        const j = (await res.json()) as { metrics?: Metrics; error?: string };
        if (!res.ok) throw new Error(j.error ?? "Failed to load metrics");
        if (!cancelled) {
          setMetrics(j.metrics ?? null);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load metrics");
        }
      }
    }
    void load(true);
    const t = setInterval(() => void load(true), 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [serverId]);

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (!metrics) {
    return <p className="text-muted-foreground text-sm">Collecting metrics over SSH…</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Load</CardTitle>
          <CardDescription>{metrics.uptime}</CardDescription>
        </CardHeader>
        <CardContent className="font-mono text-sm">
          <p>1m: {metrics.load1.toFixed(2)}</p>
          <p>5m: {metrics.load5.toFixed(2)}</p>
          <p>15m: {metrics.load15.toFixed(2)}</p>
          <p className="text-muted-foreground mt-1 text-xs">{metrics.cpuCount} CPUs</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Memory</CardTitle>
          <CardDescription>
            {metrics.memUsedMb} / {metrics.memTotalMb} MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${Math.min(100, metrics.memUsedPct)}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">{metrics.memUsedPct}% used</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Disk ({metrics.diskMount})</CardTitle>
          <CardDescription>{metrics.diskAvail} free</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${Math.min(100, metrics.diskUsedPct)}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">{metrics.diskUsedPct}% used</p>
        </CardContent>
      </Card>
      {metrics.tcpEstablished != null ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Network</CardTitle>
            <CardDescription>TCP established</CardDescription>
          </CardHeader>
          <CardContent className="font-mono text-2xl">{metrics.tcpEstablished}</CardContent>
        </Card>
      ) : null}
      <p className="text-muted-foreground col-span-full text-xs">
        Last collected: {new Date(metrics.collectedAt).toLocaleString()} · refreshes every 10s
      </p>
    </div>
  );
}
