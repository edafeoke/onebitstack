import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { serversAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { DashboardPage } from "@/components/dashboard-page";
import { ServerRowActions } from "@/components/server-row-actions";

export default async function ServersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return null;
  }
  const servers = await prisma.server.findMany({
    where: serversAccessibleWhere(session.user.id),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      host: true,
      sshUser: true,
      webStack: true,
      _count: { select: { projects: true } }
    }
  });

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          SSH targets. Private keys are encrypted at rest.
        </p>
        <Link href="/dashboard/servers/new" className={cn(buttonVariants())}>
          Add server
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registered VPS</CardTitle>
          <CardDescription>Host, user, and encrypted credentials</CardDescription>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No servers yet.{" "}
              <Link href="/dashboard/servers/new" className="text-primary underline">
                Add your first VPS
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>SSH user</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.host}</TableCell>
                    <TableCell>{s.sshUser}</TableCell>
                    <TableCell className="text-right">
                      <ServerRowActions
                        serverId={s.id}
                        serverName={s.name}
                        projectCount={s._count.projects}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
