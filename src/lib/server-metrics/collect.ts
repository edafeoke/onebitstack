import type { DeployTarget } from "@/lib/deploy/types";
import { withSshSession } from "@/lib/deploy/ssh-session";

export type ServerMetricsSnapshot = {
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

function parseNumber(s: string, fallback = 0): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function parseMetricsScriptOutput(raw: string): ServerMetricsSnapshot {
  const kv = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    kv.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }

  const memTotal = parseNumber(kv.get("mem_total_mb") ?? "0");
  const memUsed = parseNumber(kv.get("mem_used_mb") ?? "0");
  const memPct = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;

  return {
    collectedAt: new Date().toISOString(),
    uptime: kv.get("uptime") ?? "unknown",
    load1: parseNumber(kv.get("load1") ?? "0"),
    load5: parseNumber(kv.get("load5") ?? "0"),
    load15: parseNumber(kv.get("load15") ?? "0"),
    cpuCount: parseNumber(kv.get("cpu_count") ?? "1", 1),
    memTotalMb: memTotal,
    memUsedMb: memUsed,
    memUsedPct: memPct,
    diskUsedPct: parseNumber((kv.get("disk_used_pct") ?? "0").replace("%", "")),
    diskAvail: kv.get("disk_avail") ?? "—",
    diskMount: kv.get("disk_mount") ?? "/",
    tcpEstablished: kv.has("tcp_established")
      ? parseNumber(kv.get("tcp_established") ?? "0")
      : undefined
  };
}

const METRICS_SCRIPT = `
mem_total_mb=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
mem_used_mb=$(free -m 2>/dev/null | awk '/^Mem:/{print $3}')
load1=$(awk '{print $1}' /proc/loadavg 2>/dev/null)
load5=$(awk '{print $2}' /proc/loadavg 2>/dev/null)
load15=$(awk '{print $3}' /proc/loadavg 2>/dev/null)
cpu_count=$(nproc 2>/dev/null || echo 1)
uptime=$(uptime -p 2>/dev/null | tr -d '\\n' || uptime | tr -d '\\n')
disk_used_pct=$(df -h / 2>/dev/null | awk 'NR==2{print $5}')
disk_avail=$(df -h / 2>/dev/null | awk 'NR==2{print $4}')
disk_mount=$(df -h / 2>/dev/null | awk 'NR==2{print $6}')
tcp_established=$(ss -tan state established 2>/dev/null | wc -l | tr -d ' ')
echo "mem_total_mb=$mem_total_mb"
echo "mem_used_mb=$mem_used_mb"
echo "load1=$load1"
echo "load5=$load5"
echo "load15=$load15"
echo "cpu_count=$cpu_count"
echo "uptime=$uptime"
echo "disk_used_pct=$disk_used_pct"
echo "disk_avail=$disk_avail"
echo "disk_mount=$disk_mount"
echo "tcp_established=$tcp_established"
`.trim();

export async function collectServerMetrics(
  target: DeployTarget
): Promise<ServerMetricsSnapshot> {
  const raw = await withSshSession(target, undefined, undefined, async (ssh) =>
    ssh.execCapture(`bash -lc 'set +e; ${METRICS_SCRIPT.replace(/'/g, `'\"'\"'`)}'`)
  );
  return parseMetricsScriptOutput(raw);
}
