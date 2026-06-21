"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ColoredLogLine } from "@/components/colored-log-line";
import { LOG_CONSOLE_SCROLL_CLASS } from "@/lib/log-line-styles";

type LogLine = { seq: number; line: string };

export function ProvisioningLogsConsole({
  serverId,
  runId
}: {
  serverId: string;
  runId: string;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(
      `/api/servers/${encodeURIComponent(serverId)}/provisioning/${encodeURIComponent(runId)}/logs`,
      { withCredentials: true }
    );
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
    es.addEventListener("error", () => es.close());
    return () => es.close();
  }, [serverId, runId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="space-y-2">
      {status ? (
        <p className="text-muted-foreground text-xs">Status: {status}</p>
      ) : (
        <p className="text-muted-foreground text-xs">Streaming…</p>
      )}
      <ScrollArea className={cn("h-64", LOG_CONSOLE_SCROLL_CLASS)}>
        {lines.map((l) => (
          <ColoredLogLine key={l.seq} line={l.line} />
        ))}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
