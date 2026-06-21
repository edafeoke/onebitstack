import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgPermissions } from "@/lib/auth/permissions";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPage } from "@/components/dashboard-page";
import { ServerCapabilitiesPanel } from "@/components/server-capabilities-panel";
import { ServerOpsPanel } from "@/components/server-ops-panel";
import { ServerSslPanel } from "@/components/server-ssl-panel";
import { ServerAgentPanel } from "@/components/server-agent-panel";
import { ColoredLogLine } from "@/components/colored-log-line";
import { ProvisioningLogsConsole } from "@/components/provisioning-logs-console";
import { LOG_CONSOLE_SCROLL_CLASS } from "@/lib/log-line-styles";
import type { ServerCapabilities } from "@/lib/provision/debian";

export default async function ServerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const { run: activeRunId } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const server = await prisma.server.findFirst({
    where: { id, ...serversAccessibleWhere(session.user.id) },
    include: {
      provisioningRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { logChunks: { orderBy: { seq: "asc" }, take: 80 } }
      }
    }
  });
  if (!server) notFound();

  const permissions = await getOrgPermissions(session.user.id, server.organizationId);

  let caps: ServerCapabilities = {};
  try {
    caps = server.capabilitiesJson
      ? (JSON.parse(server.capabilitiesJson) as ServerCapabilities)
      : {};
  } catch {
    caps = {};
  }

  const run = server.provisioningRuns[0];
  const streamRunId = activeRunId ?? (run?.status === "running" ? run.id : undefined);

  return (
    <DashboardPage>
      <Link href="/dashboard/servers" className={cn(buttonVariants({ variant: "ghost" }))}>
        ← Servers
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{server.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">{server.host}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/servers/${server.id}/logs`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Logs
          </Link>
          <Link
            href={`/dashboard/servers/${server.id}/metrics`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Metrics
          </Link>
          <Link
            href={`/dashboard/servers/${server.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Edit
          </Link>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Central agent</CardTitle>
          <CardDescription>
            Optional daemon on this VPS for local builds (pairs with Central Server).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServerAgentPanel
            serverId={server.id}
            serverHost={server.host}
            agentStatus={server.agentStatus}
            lastAgentHeartbeatAt={server.lastAgentHeartbeatAt?.toISOString() ?? null}
            agentVersion={server.agentVersion}
            canManage={permissions.canManageServers}
          />
        </CardContent>
      </Card>
      <ServerCapabilitiesPanel
        serverId={server.id}
        capabilities={caps}
        lastProbeAt={server.lastCapabilityProbeAt?.toISOString() ?? null}
      />
      <Card>
        <CardHeader>
          <CardTitle>TLS / SSL</CardTitle>
          <CardDescription>Certificate paths used by generated nginx/apache configs.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerSslPanel
            serverId={server.id}
            initialCertPath={server.tlsCertPath}
            initialKeyPath={server.tlsKeyPath}
            canDestructive={permissions.canDestructive}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Provisioning</CardTitle>
          <CardDescription>Requires sudo without password for apt/systemctl (see OPS.md).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ServerOpsPanel serverId={server.id} canDestructive={permissions.canDestructive} />
          {streamRunId ? (
            <div>
              <p className="text-muted-foreground mb-2 text-xs">Live provisioning log</p>
              <ProvisioningLogsConsole serverId={server.id} runId={streamRunId} />
            </div>
          ) : run ? (
            <div>
              <p className="text-muted-foreground mb-2 text-xs">
                Last run: {run.status} · {run.startedAt.toISOString()}
              </p>
              <div className={cn("max-h-64 overflow-auto", LOG_CONSOLE_SCROLL_CLASS)}>
                {run.logChunks.map((c) => (
                  <ColoredLogLine key={c.seq} line={c.line} />
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
