"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColoredLogLine } from "@/components/colored-log-line";
import { LOG_CONSOLE_SCROLL_CLASS } from "@/lib/log-line-styles";
import { cn } from "@/lib/utils";
import type { LogSource } from "@/lib/server-logs/paths";

type LogLine = { seq: number; line: string };

const SOURCES: { id: LogSource; label: string }[] = [
  { id: "nginx", label: "Nginx" },
  { id: "apache", label: "Apache" },
  { id: "pm2", label: "PM2" },
  { id: "app", label: "App" },
  { id: "deployment", label: "Deployment" }
];

export function ServerLogsConsole({
  serverId,
  projectId,
  deploymentId,
  initialSource = "nginx"
}: {
  serverId: string;
  projectId?: string;
  deploymentId?: string;
  initialSource?: LogSource;
}) {
  const [source, setSource] = useState<LogSource>(initialSource);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);
    setStatus(null);
    const params = new URLSearchParams({ source, tail: "200" });
    if (projectId) params.set("projectId", projectId);
    if (deploymentId && source === "deployment") params.set("deploymentId", deploymentId);

    const es = new EventSource(
      `/api/servers/${encodeURIComponent(serverId)}/logs/stream?${params}`,
      { withCredentials: true }
    );

    es.addEventListener("line", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as LogLine;
      setLines((prev) => {
        if (prev.some((l) => l.seq === data.seq)) return prev;
        return [...prev, data];
      });
    });
    es.addEventListener("done", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { status: string };
      setStatus(data.status);
    });
    es.addEventListener("error", () => es.close());

    return () => es.close();
  }, [serverId, source, projectId, deploymentId]);

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

  const download = () => {
    const blob = new Blob([filtered.map((l) => l.line).join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `server-${serverId}-${source}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={cn(
              "rounded-md px-3 py-1 text-sm capitalize",
              source === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted border"
            )}
            onClick={() => setSource(s.id)}
          >
            {s.label}
          </button>
        ))}
        {status ? (
          <span className="text-muted-foreground self-center text-xs">· {status}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter lines…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs underline"
          onClick={download}
        >
          Download
        </button>
      </div>
      <ScrollArea className={cn("h-[min(70vh,560px)]", LOG_CONSOLE_SCROLL_CLASS)}>
        {filtered.map((l) => (
          <ColoredLogLine key={l.seq} line={l.line} />
        ))}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
