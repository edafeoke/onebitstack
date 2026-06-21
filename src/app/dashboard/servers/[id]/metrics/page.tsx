import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardPage } from "@/components/dashboard-page";
import { ServerMetricsPanel } from "@/components/server-metrics-panel";

export default async function ServerMetricsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const server = await prisma.server.findFirst({
    where: { id, ...serversAccessibleWhere(session.user.id) },
    select: { id: true, name: true, host: true }
  });
  if (!server) notFound();

  return (
    <DashboardPage>
      <Link href={`/dashboard/servers/${server.id}`} className={cn(buttonVariants({ variant: "ghost" }))}>
        ← {server.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Server metrics</h1>
        <p className="text-muted-foreground font-mono text-sm">{server.host}</p>
      </div>
      <ServerMetricsPanel serverId={server.id} />
    </DashboardPage>
  );
}
