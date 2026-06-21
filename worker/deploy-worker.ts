/**
 * Background deployment worker (BullMQ).
 * Run alongside the Next.js app when REDIS_URL is configured:
 *   npm run worker:deploy
 */
import "dotenv/config";
import { Worker } from "bullmq";
import { DEPLOY_QUEUE_NAME } from "../src/lib/queue/constants";
import type { DeployJobData } from "../src/lib/queue/deploy-job";
import {
  closeDeployProcessorRedis,
  processDeployJob
} from "../src/lib/queue/deploy-processor";
import { createRedisConnection, isRedisQueueEnabled } from "../src/lib/queue/redis";

if (!isRedisQueueEnabled()) {
  console.error(
    "[deploy-worker] REDIS_URL is not set. Start Redis (docker compose up -d redis) and set REDIS_URL=redis://127.0.0.1:6379"
  );
  process.exit(1);
}

const connection = createRedisConnection();

const worker = new Worker<DeployJobData>(DEPLOY_QUEUE_NAME, processDeployJob, {
  connection,
  concurrency: 10
});

worker.on("completed", (job) => {
  console.log(`[deploy-worker] completed ${job.data.deploymentId}`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[deploy-worker] failed ${job?.data.deploymentId ?? "unknown"}:`,
    err.message
  );
});

worker.on("error", (err) => {
  console.error("[deploy-worker] error:", err);
});

async function shutdown(signal: string) {
  console.log(`[deploy-worker] ${signal} — shutting down`);
  await worker.close();
  await closeDeployProcessorRedis();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`[deploy-worker] listening on queue "${DEPLOY_QUEUE_NAME}"`);
