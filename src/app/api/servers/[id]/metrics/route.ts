import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { deployTargetForServer } from "@/lib/server-ssh-target";
import { collectServerMetrics } from "@/lib/server-metrics/collect";
import { getCachedMetrics, setCachedMetrics } from "@/lib/server-metrics/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: serverId } = await context.params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const live = new URL(request.url).searchParams.get("live") === "1";
  if (!live) {
    const cached = getCachedMetrics(serverId);
    if (cached) {
      return Response.json({ metrics: cached, cached: true });
    }
  }

  const ctx = await deployTargetForServer(serverId, session.user.id);
  if (!ctx) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const metrics = await collectServerMetrics(ctx.target);
    setCachedMetrics(serverId, metrics);
    return Response.json({ metrics, cached: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 502 });
  }
}
