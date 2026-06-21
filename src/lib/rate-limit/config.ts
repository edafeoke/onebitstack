import type { RateLimitConfig } from "@/lib/rate-limit/memory";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Per-repository GitHub push webhook deliveries per minute. */
export function githubWebhookRepoRateLimit(): RateLimitConfig {
  return {
    limit: intEnv("GITHUB_WEBHOOK_REPO_RATE_LIMIT", 30),
    windowMs: 60_000
  };
}

/** Manual/API deploys per project per 10 minutes. */
export function deployApiProjectRateLimit(): RateLimitConfig {
  return {
    limit: intEnv("DEPLOY_API_PROJECT_RATE_LIMIT", 5),
    windowMs: 600_000
  };
}

/** Manual/API deploys per user per 10 minutes. */
export function deployApiUserRateLimit(): RateLimitConfig {
  return {
    limit: intEnv("DEPLOY_API_USER_RATE_LIMIT", 20),
    windowMs: 600_000
  };
}

/** Deployments queued from git push per project per 5 minutes. */
export function githubPushProjectRateLimit(): RateLimitConfig {
  return {
    limit: intEnv("GITHUB_PUSH_PROJECT_RATE_LIMIT", 10),
    windowMs: 300_000
  };
}

/** GitHub stack detection per user per minute (GitHub API cost). */
export function detectStackUserRateLimit(): RateLimitConfig {
  return {
    limit: intEnv("DETECT_STACK_USER_RATE_LIMIT", 20),
    windowMs: 60_000
  };
}

/** Agent pairing attempts per client IP per 15 minutes. */
export function agentPairIpRateLimit(): RateLimitConfig {
  return {
    limit: intEnv("AGENT_PAIR_IP_RATE_LIMIT", 10),
    windowMs: 900_000
  };
}
