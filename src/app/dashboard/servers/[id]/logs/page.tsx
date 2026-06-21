import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPage } from "@/components/dashboard-page";
import { ServerLogsConsole } from "@/components/server-logs-console";
import type { LogSource } from "@/lib/server-logs/paths";

export default async function ServerLogsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string; deploymentId?: string; source?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const server = await prisma.server.findFirst({
    where: { id, ...serversAccessibleWhere(session.user.id) },
    select: { id: true, name: true, host: true }
  });
  if (!server) notFound();

  const initialSource = (sp.source ?? "nginx") as LogSource;

  return (
    <DashboardPage>
      <Link href={`/dashboard/servers/${server.id}`} className={cn(buttonVariants({ variant: "ghost" }))}>
        ← {server.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Server logs</h1>
        <p className="text-muted-foreground font-mono text-sm">{server.host}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Live tail</CardTitle>
          <CardDescription>
            Streams nginx, apache, PM2, or app logs over SSH. Deployment source reads stored deploy logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServerLogsConsole
            serverId={server.id}
            projectId={sp.projectId}
            deploymentId={sp.deploymentId}
            initialSource={initialSource}
          />
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
