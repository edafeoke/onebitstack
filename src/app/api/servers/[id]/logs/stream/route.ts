import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { deployTargetForServer } from "@/lib/server-ssh-target";
import {
  fetchDeploymentLogLines,
  fetchRemoteLogSnapshot
} from "@/lib/server-logs/fetch";
import type { LogSource } from "@/lib/server-logs/paths";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = new Set<LogSource>(["nginx", "apache", "pm2", "app", "deployment"]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: serverId } = await context.params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const source = (url.searchParams.get("source") ?? "nginx") as LogSource;
  if (!SOURCES.has(source)) {
    return new Response("Invalid source", { status: 400 });
  }
  const tail = Math.min(500, Math.max(20, Number(url.searchParams.get("tail") ?? "200")));
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const deploymentId = url.searchParams.get("deploymentId") ?? undefined;

  const ctx = await deployTargetForServer(serverId, session.user.id);
  if (!ctx) {
    return new Response("Not found", { status: 404 });
  }

  let projectName: string | undefined;
  if (projectId) {
    const p = await prisma.project.findFirst({
      where: { id: projectId, serverId, ...projectsAccessibleWhere(session.user.id) },
      select: { name: true }
    });
    projectName = p?.name;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("meta", { serverId, source });
      let seq = 0;
      let prevText = "";
      const started = Date.now();
      const maxMs = 15 * 60 * 1000;

      try {
        while (Date.now() - started < maxMs) {
          if (source === "deployment" && deploymentId) {
            const lines = await fetchDeploymentLogLines(
              deploymentId,
              session.user!.id,
              tail
            );
            for (const line of lines) {
              seq += 1;
              send("line", { seq, line });
            }
            const dep = await prisma.deployment.findFirst({
              where: { id: deploymentId, project: projectsAccessibleWhere(session.user!.id) },
              select: { status: true }
            });
            if (dep?.status && ["success", "failed", "cancelled"].includes(dep.status)) {
              send("done", { status: dep.status });
              break;
            }
          } else {
            const snap = await fetchRemoteLogSnapshot({
              target: ctx.target,
              source,
              tail,
              projectName
            });
            const text = snap.text;
            const delta =
              text.length >= prevText.length && text.startsWith(prevText)
                ? text.slice(prevText.length)
                : text;
            prevText = text;
            if (delta.trim()) {
              for (const line of delta.split("\n")) {
                if (!line.length) continue;
                seq += 1;
                send("line", { seq, line });
              }
            }
          }
          await sleep(1200);
        }
        send("done", { status: "idle" });
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
