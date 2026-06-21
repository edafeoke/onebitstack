import { z } from "zod";
import { authenticateAgentRequest } from "@/lib/agent/auth";
import { completeAgentJob } from "@/lib/agent/jobs";
import { appendDeploymentLogLine } from "@/lib/deploy";

export const runtime = "nodejs";

const bodySchema = z.object({
  exitCode: z.number().int()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const auth = await authenticateAgentRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const json = (await request.json()) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "exitCode required" }, { status: 400 });
  }

  const result = await completeAgentJob({
    jobId,
    serverId: auth.serverId,
    exitCode: parsed.data.exitCode
  });
  if (!result) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  if (parsed.data.exitCode === 0) {
    await appendDeploymentLogLine(result.deploymentId, "[agent] Job finished successfully");
  } else {
    await appendDeploymentLogLine(
      result.deploymentId,
      `[agent] Job failed with exit code ${parsed.data.exitCode}`
    );
  }

  return Response.json({ ok: true, deploymentId: result.deploymentId });
}
