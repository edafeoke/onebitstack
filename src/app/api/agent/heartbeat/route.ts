import { z } from "zod";
import { authenticateAgentRequest } from "@/lib/agent/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  agentVersion: z.string().optional()
});

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateAgentRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let version: string | undefined;
  try {
    const json = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(json);
    if (parsed.success) version = parsed.data.agentVersion;
  } catch {
    // empty body ok
  }

  await prisma.server.update({
    where: { id: auth.serverId },
    data: {
      agentStatus: "connected",
      lastAgentHeartbeatAt: new Date(),
      ...(version ? { agentVersion: version.trim() } : {})
    }
  });

  return Response.json({ ok: true });
}
