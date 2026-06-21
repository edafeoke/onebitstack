import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { installationsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { detectTechStackRemote } from "@/lib/github/detect-tech-stack-remote";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectStackUserRateLimit } from "@/lib/rate-limit/config";

export const runtime = "nodejs";

const bodySchema = z.object({
  fullName: z.string().min(3),
  branch: z.string().min(1),
  installationId: z.string().min(1)
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.gitHubAppInstallation.findFirst({
    where: {
      installationId: parsed.data.installationId,
      suspended: false,
      ...installationsAccessibleWhere(session.user.id)
    }
  });
  if (!row) {
    return Response.json({ error: "Installation not found" }, { status: 404 });
  }

  const rl = await checkRateLimit(`detect-stack:${session.user.id}`, detectStackUserRateLimit());
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many stack detection requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) }
      }
    );
  }

  try {
    const stack = await detectTechStackRemote(parsed.data);
    return Response.json(stack);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 502 });
  }
}
