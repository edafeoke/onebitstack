import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { projectsAccessibleWhere } from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { formatDeploymentDuration } from "@/lib/deployment-format";
import { Button } from "@/components/ui/button";
import { DashboardPage } from "@/components/dashboard-page";
import {
  DeploymentKindBadge,
  DeploymentStatusBadge
} from "@/components/deployment-status-badge";
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

export default async function DeploymentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;

  const deployments = await prisma.deployment.findMany({
    where: { project: projectsAccessibleWhere(userId) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      project: { select: { id: true, name: true, repository: true, serverId: true } },
      environment: { select: { branch: true, slug: true } }
    }
  });

  return (
    <DashboardPage>
      <Card>
        <CardHeader>
          <CardTitle>Deployments</CardTitle>
          <CardDescription>
            Build output, release paths, and rollback for each run across your projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No deployments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/dashboard/projects/${d.project.id}`}
                          className="font-medium hover:underline"
                        >
                          {d.project.name}
                        </Link>
                        <p className="text-muted-foreground font-mono text-xs">
                          {d.project.repository}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.environment.branch}
                      <span className="text-muted-foreground"> ({d.environment.slug})</span>
                    </TableCell>
                    <TableCell>
                      <DeploymentKindBadge kind={d.kind} />
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize text-xs">
                      {d.trigger.replace("_", " ")}
                    </TableCell>
                    <TableCell>
                      <DeploymentStatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDeploymentDuration(d.startedAt, d.finishedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/dashboard/deployments/${d.id}`} />}
                        >
                          Logs
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          render={
                            <Link
                              href={`/dashboard/servers/${d.project.serverId}/logs?projectId=${d.project.id}&deploymentId=${d.id}&source=deployment`}
                            />
                          }
                        >
                          Server
                        </Button>
                      </div>
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
