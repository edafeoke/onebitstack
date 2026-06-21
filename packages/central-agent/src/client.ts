import type { AgentConfig } from "./config.js";

export class AgentClient {
  constructor(private readonly config: AgentConfig) {}

  private url(path: string): string {
    const base = this.config.apiBaseUrl.replace(/\/$/, "");
    return `${base}${path}`;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
      ...extra
    };
  }

  async pair(pairingToken: string, agentVersion: string): Promise<AgentConfig> {
    const res = await fetch(this.url("/api/agent/pair"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingToken, agentVersion })
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Pair failed (${res.status})`);
    }
    const data = (await res.json()) as {
      accessToken: string;
      serverId: string;
      agentId: string;
    };
    return {
      apiBaseUrl: this.config.apiBaseUrl,
      accessToken: data.accessToken,
      serverId: data.serverId,
      agentId: data.agentId
    };
  }

  async heartbeat(agentVersion: string): Promise<void> {
    await fetch(this.url("/api/agent/heartbeat"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ agentVersion })
    });
  }

  async pollJob(): Promise<{
    jobId: string;
    deploymentId: string;
    script: string;
  } | null> {
    const res = await fetch(this.url("/api/agent/jobs/next"), {
      headers: this.headers()
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`poll failed (${res.status})`);
    return (await res.json()) as { jobId: string; deploymentId: string; script: string };
  }

  async startJob(jobId: string, deploymentId: string): Promise<void> {
    const res = await fetch(this.url(`/api/agent/jobs/${jobId}/start`), {
      method: "POST",
      headers: this.headers({ "x-deployment-id": deploymentId })
    });
    if (!res.ok) throw new Error(`start job failed (${res.status})`);
  }

  async postLogs(
    jobId: string,
    deploymentId: string,
    lines: { stream: "stdout" | "stderr"; line: string }[]
  ): Promise<void> {
    if (lines.length === 0) return;
    await fetch(this.url(`/api/agent/jobs/${jobId}/logs`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ deploymentId, lines })
    });
  }

  async completeJob(jobId: string, exitCode: number): Promise<void> {
    const res = await fetch(this.url(`/api/agent/jobs/${jobId}/complete`), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ exitCode })
    });
    if (!res.ok) throw new Error(`complete failed (${res.status})`);
  }
}
