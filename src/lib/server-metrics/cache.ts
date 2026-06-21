import type { ServerMetricsSnapshot } from "@/lib/server-metrics/collect";

const TTL_MS = Number(process.env.SERVER_METRICS_CACHE_MS ?? 10_000);
const cache = new Map<string, { at: number; data: ServerMetricsSnapshot }>();

export function getCachedMetrics(serverId: string): ServerMetricsSnapshot | null {
  const row = cache.get(serverId);
  if (!row) return null;
  if (Date.now() - row.at > TTL_MS) {
    cache.delete(serverId);
    return null;
  }
  return row.data;
}

export function setCachedMetrics(serverId: string, data: ServerMetricsSnapshot): void {
  cache.set(serverId, { at: Date.now(), data });
}
