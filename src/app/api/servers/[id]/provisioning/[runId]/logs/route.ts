import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const TERMINAL = new Set(["success", "failed"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; runId: string }> }
): Promise<Response> {
  const { id: serverId, runId } = await context.params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const run = await prisma.provisioningRun.findFirst({
    where: { id: runId, serverId, server: serversAccessibleWhere(session.user.id) },
    select: { id: true }
  });
  if (!run) {
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

      send("meta", { runId });
      let lastSeq = 0;
      const started = Date.now();
      const maxMs = 30 * 60 * 1000;

      try {
        while (Date.now() - started < maxMs) {
          const row = await prisma.provisioningRun.findUnique({
            where: { id: runId },
            select: { status: true }
          });
          if (!row) break;

          const chunks = await prisma.provisioningLogChunk.findMany({
            where: { provisioningRunId: runId, seq: { gt: lastSeq } },
            orderBy: { seq: "asc" }
          });
          for (const c of chunks) {
            send("line", { seq: c.seq, line: c.line });
            lastSeq = c.seq;
          }

          if (row.status && TERMINAL.has(row.status)) {
            send("done", { status: row.status });
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
