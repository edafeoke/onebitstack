import { z } from "zod";
import { pairAgentWithToken } from "@/lib/agent/pairing";
import { clientIpFromRequest } from "@/lib/api/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { agentPairIpRateLimit } from "@/lib/rate-limit/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  pairingToken: z.string().min(16),
  agentVersion: z.string().optional()
});

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "pairingToken required" }, { status: 400 });
  }

  const ip = clientIpFromRequest(request);
  const rl = await checkRateLimit(`agent-pair:${ip}`, agentPairIpRateLimit());
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many pairing attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) }
      }
    );
  }

  const result = await pairAgentWithToken(parsed.data);
  if (!result.ok) {
    return Response.json({ error: result.message }, { status: 401 });
  }

  return Response.json({
    accessToken: result.accessToken,
    serverId: result.serverId,
    agentId: result.agentId
  });
}
