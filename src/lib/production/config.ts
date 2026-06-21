import { isRedisQueueEnabled } from "@/lib/queue/redis";

export { isRedisQueueEnabled };

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** When true, full deploys on paired agents must not fall back to SSH from the control plane. */
export function isAgentPrimaryMode(): boolean {
  const v = process.env.AGENT_PRIMARY?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** When true, production must use BullMQ (REDIS_URL) — no in-process deploy queue. */
export function requireRedisQueueInProduction(): boolean {
  const v = process.env.REQUIRE_REDIS_QUEUE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return isProductionRuntime();
}

export function assertDeployQueueAvailable(): { ok: true } | { ok: false; message: string } {
  if (requireRedisQueueInProduction() && !isRedisQueueEnabled()) {
    return {
      ok: false,
      message:
        "REDIS_URL is required in production. Start Redis, set REDIS_URL, and run npm run worker:deploy."
    };
  }
  return { ok: true };
}

export function sslExpiryWarnDays(): number {
  const raw = process.env.SSL_EXPIRY_WARN_DAYS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 14;
  return Number.isFinite(n) && n > 0 ? n : 14;
}

export type ProductionMisconfig = {
  code: string;
  message: string;
};

export function collectProductionMisconfigs(): ProductionMisconfig[] {
  if (!isProductionRuntime()) return [];

  const issues: ProductionMisconfig[] = [];

  if (!isRedisQueueEnabled()) {
    issues.push({
      code: "redis-missing",
      message: "REDIS_URL is unset — deploy jobs will not survive app restarts."
    });
  }

  if (!process.env.ENCRYPTION_KEY?.trim()) {
    issues.push({
      code: "encryption-key",
      message: "ENCRYPTION_KEY is unset — SSH keys cannot be stored securely."
    });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    issues.push({
      code: "database-url",
      message: "DATABASE_URL is unset."
    });
  }

  return issues;
}
