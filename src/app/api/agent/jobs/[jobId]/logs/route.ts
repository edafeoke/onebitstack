import { z } from "zod";
import { authenticateAgentRequest } from "@/lib/agent/auth";
import { prisma } from "@/lib/prisma";
import { appendDeploymentLogLine } from "@/lib/deploy";

export const runtime = "nodejs";

const bodySchema = z.object({
  deploymentId: z.string().min(1),
  lines: z.array(
    z.object({
      stream: z.enum(["stdout", "stderr"]),
      line: z.string().max(16_384)
    })
  )
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
  const job = await prisma.agentJob.findFirst({
    where: { id: jobId, serverId: auth.serverId }
  });
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  const json = (await request.json()) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (parsed.data.deploymentId !== job.deploymentId) {
    return Response.json({ error: "deploymentId mismatch" }, { status: 400 });
  }

  for (const entry of parsed.data.lines) {
    const prefix = entry.stream === "stderr" ? "[stderr] " : "[stdout] ";
    await appendDeploymentLogLine(job.deploymentId, `${prefix}${entry.line}`);
  }

  return Response.json({ ok: true });
}
