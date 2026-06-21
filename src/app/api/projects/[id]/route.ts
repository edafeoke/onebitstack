import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const patchSchema = z.object({
  framework: z.string().optional().nullable(),
  runtime: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  webServer: z.enum(["nginx", "apache"]).optional().nullable(),
  buildCommand: z.string().optional().nullable(),
  startCommand: z.string().optional().nullable(),
  restartCommand: z.string().optional().nullable(),
  nginxConfig: z.string().optional().nullable(),
  apacheConfig: z.string().optional().nullable(),
  pm2Config: z.string().optional().nullable()
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const json: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const project = await prisma.project.findFirst({
    where: { id, ...projectsAccessibleWhere(session.user.id) }
  });
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.project.update({
    where: { id: project.id },
    data: {
      framework: parsed.data.framework ?? undefined,
      runtime: parsed.data.runtime ?? undefined,
      domain: parsed.data.domain ?? undefined,
      webServer: parsed.data.webServer ?? undefined,
      buildCommand: parsed.data.buildCommand ?? undefined,
      startCommand: parsed.data.startCommand ?? undefined,
      restartCommand: parsed.data.restartCommand ?? undefined,
      nginxConfig: parsed.data.nginxConfig ?? undefined,
      apacheConfig: parsed.data.apacheConfig ?? undefined,
      pm2Config: parsed.data.pm2Config ?? undefined
    }
  });
  return Response.json({ ok: true });
}
