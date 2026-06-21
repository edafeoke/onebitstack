import { authenticateAgentRequest } from "@/lib/agent/auth";
import { claimNextAgentJob } from "@/lib/agent/jobs";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateAgentRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await claimNextAgentJob(auth.serverId);
  if (!job) {
    return new Response(null, { status: 204 });
  }

  return Response.json({
    jobId: job.id,
    deploymentId: job.deploymentId,
    script: job.script
  });
}
