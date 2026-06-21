import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  projectsAccessibleWhere,
  serversAccessibleWhere
} from "@/lib/organization/access";
import { prisma } from "@/lib/prisma";
import { DashboardPage } from "@/components/dashboard-page";
import { DashboardOverviewCards } from "@/components/dashboard-overview-cards";
import { DashboardHealthAlerts } from "@/components/dashboard-health-alerts";
import { collectHealthAlerts } from "@/lib/health/alerts";
import { getOnboardingSteps, onboardingIncomplete } from "@/lib/onboarding/steps";
import { DashboardOnboarding } from "@/components/dashboard-onboarding";
import { DashboardProductionWarnings } from "@/components/dashboard-production-warnings";
import { DeploymentKindBadge, DeploymentStatusBadge } from "@/components/deployment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default async function DashboardHomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [projectCount, serverCount, runningCount, failedRecent, recent, healthAlerts, onboardingSteps] =
    await Promise.all([
      prisma.project.count({ where: projectsAccessibleWhere(userId) }),
      prisma.server.count({ where: serversAccessibleWhere(userId) }),
      prisma.deployment.count({
        where: {
          project: projectsAccessibleWhere(userId),
          status: { in: ["queued", "running"] }
        }
      }),
      prisma.deployment.count({
        where: {
          project: projectsAccessibleWhere(userId),
          status: "failed",
          createdAt: { gte: since24h }
        }
      }),
      prisma.deployment.findMany({
        where: { project: projectsAccessibleWhere(userId) },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          project: { select: { id: true, name: true, repository: true } },
          environment: { select: { slug: true, branch: true } }
        }
      }),
      collectHealthAlerts(userId),
      getOnboardingSteps(userId)
    ]);

  return (
    <DashboardPage>
      <DashboardProductionWarnings />
      {onboardingIncomplete(onboardingSteps) ? (
        <DashboardOnboarding steps={onboardingSteps} />
      ) : null}
      {healthAlerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Health</CardTitle>
            <CardDescription>Items that may need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardHealthAlerts alerts={healthAlerts} />
          </CardContent>
        </Card>
      ) : null}
      <DashboardOverviewCards
        projectCount={projectCount}
        serverCount={serverCount}
        runningCount={runningCount}
        failedRecent={failedRecent}
      />
      <Card>
          <CardHeader>
            <CardTitle>Recent deployments</CardTitle>
            <CardDescription>
              Signed in as {session.user.email} · latest runs across projects
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recent.length === 0 ? (
              <div className="text-muted-foreground flex flex-col gap-2 text-sm">
                <p>No deployments yet.</p>
                <Button size="sm" render={<Link href="/dashboard/projects/new" />}>
                  Create a project
                </Button>
              </div>
            ) : (
              recent.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{d.project.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {d.project.repository} · {d.environment.branch}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DeploymentKindBadge kind={d.kind} />
                    <DeploymentStatusBadge status={d.status} />
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/dashboard/deployments/${d.id}`} />}
                    >
                      Logs
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/dashboard/projects/${d.project.id}`} />}
                    >
                      Project
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
      </Card>
    </DashboardPage>
  );
}
