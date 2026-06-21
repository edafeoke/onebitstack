import "server-only";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Redis from "ioredis";
import { getDatabaseProvider } from "@/lib/database/provider";
import { prisma } from "@/lib/prisma";

export async function checkDatabase(): Promise<{ ok: boolean; message: string; provider?: string }> {
  const provider = getDatabaseProvider();
  try {
    if (provider === "sqlite") {
      const url = process.env.DATABASE_URL?.trim() ?? "";
      const filePath = url.startsWith("file:") ? url.slice(5) : url;
      const abs = resolve(process.cwd(), filePath);
      if (!existsSync(abs)) {
        return {
          ok: false,
          provider,
          message: `SQLite file not found: ${abs} (run: npx prisma db push)`
        };
      }
    }
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      provider,
      message: provider === "sqlite" ? "SQLite is reachable." : "PostgreSQL is reachable."
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database check failed";
    return { ok: false, provider, message: msg };
  }
}

export async function checkRedis(): Promise<{ ok: boolean; message: string; skipped?: boolean }> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return { ok: true, skipped: true, message: "REDIS_URL not set (optional)." };
  }
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
  try {
    const pong = await redis.ping();
    return pong === "PONG"
      ? { ok: true, message: "Redis is reachable." }
      : { ok: false, message: "Unexpected Redis response." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Redis check failed";
    return { ok: false, message: msg };
  } finally {
    redis.disconnect();
  }
}
