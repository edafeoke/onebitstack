import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentClient } from "./client.js";

const AGENT_VERSION = "0.1.0";

export async function runJob(
  client: AgentClient,
  job: { jobId: string; deploymentId: string; script: string }
): Promise<number> {
  await client.startJob(job.jobId, job.deploymentId);

  const scriptPath = join(tmpdir(), `central-deploy-${job.deploymentId}.sh`);
  writeFileSync(scriptPath, job.script, { mode: 0o700 });

  return new Promise((resolve) => {
    const child = spawn("bash", [scriptPath], {
      env: process.env,
      cwd: "/"
    });

    let stdoutBuf = "";
    let stderrBuf = "";

    const flushLines = async (stream: "stdout" | "stderr", buf: string) => {
      const parts = buf.split("\n");
      const rest = parts.pop() ?? "";
      const lines = parts.filter((l) => l.length > 0).map((line) => ({ stream, line }));
      if (lines.length) await client.postLogs(job.jobId, job.deploymentId, lines);
      return rest;
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      void flushLines("stdout", stdoutBuf).then((r) => {
        stdoutBuf = r;
      });
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      void flushLines("stderr", stderrBuf).then((r) => {
        stderrBuf = r;
      });
    });

    child.on("close", async (code) => {
      if (stdoutBuf.trim()) {
        await client.postLogs(job.jobId, job.deploymentId, [
          { stream: "stdout", line: stdoutBuf.trimEnd() }
        ]);
      }
      if (stderrBuf.trim()) {
        await client.postLogs(job.jobId, job.deploymentId, [
          { stream: "stderr", line: stderrBuf.trimEnd() }
        ]);
      }
      try {
        unlinkSync(scriptPath);
      } catch {
        // ignore
      }
      const exitCode = code ?? 1;
      await client.completeJob(job.jobId, exitCode);
      resolve(exitCode);
    });
  });
}

export async function runAgentLoop(client: AgentClient): Promise<void> {
  console.log(`[central-agent] v${AGENT_VERSION} polling for jobs…`);

  const heartbeatMs = 30_000;
  let lastHeartbeat = 0;

  for (;;) {
    if (Date.now() - lastHeartbeat > heartbeatMs) {
      try {
        await client.heartbeat(AGENT_VERSION);
      } catch (e) {
        console.warn("[central-agent] heartbeat failed:", e);
      }
      lastHeartbeat = Date.now();
    }

    try {
      const job = await client.pollJob();
      if (!job) {
        await sleep(3000);
        continue;
      }
      console.log(`[central-agent] running job ${job.jobId} (deployment ${job.deploymentId})`);
      const code = await runJob(client, job);
      console.log(`[central-agent] job ${job.jobId} exited ${code}`);
    } catch (e) {
      console.error("[central-agent] loop error:", e);
      await sleep(5000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
