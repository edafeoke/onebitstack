import { authenticateAgentRequest } from "@/lib/agent/auth";
import { markAgentJobRunning } from "@/lib/agent/jobs";
import { appendDeploymentLogLine } from "@/lib/deploy";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const auth = await authenticateAgentRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const ok = await markAgentJobRunning(jobId, auth.serverId);
  if (!ok) {
    return Response.json({ error: "Job not found or not claimable" }, { status: 404 });
  }

  const deploymentId = request.headers.get("x-deployment-id");
  if (deploymentId) {
    await appendDeploymentLogLine(deploymentId, "[agent] Job started on VPS");
  }

  return Response.json({ ok: true });
}
