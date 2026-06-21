import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const TERMINAL = new Set<string>(["success", "failed", "cancelled"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ deploymentId: string }> }
): Promise<Response> {
  const { deploymentId } = await context.params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, project: projectsAccessibleWhere(session.user.id) },
    select: { id: true }
  });
  if (!deployment) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("meta", { deploymentId });
      let lastSeq = 0;
      let idleTicks = 0;
      const started = Date.now();
      const maxMs = 30 * 60 * 1000;

      try {
        while (Date.now() - started < maxMs) {
          const dep = await prisma.deployment.findUnique({
            where: { id: deploymentId },
            select: { status: true }
          });
          if (!dep) break;

          const chunks = await prisma.deploymentLogChunk.findMany({
            where: { deploymentId, seq: { gt: lastSeq } },
            orderBy: { seq: "asc" }
          });

          if (chunks.length > 0) {
            idleTicks = 0;
            for (const c of chunks) {
              send("line", { seq: c.seq, line: c.line });
              lastSeq = c.seq;
            }
          } else {
            idleTicks += 1;
          }

          if (dep.status && TERMINAL.has(dep.status)) {
            send("done", { status: dep.status });
            break;
          }
          if (dep.status === "running" && idleTicks >= 40) {
            send("done", { status: dep.status });
            break;
          }

          await sleep(700);
        }
      } catch (e) {
        send("error", {
          message: e instanceof Error ? e.message : String(e)
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
