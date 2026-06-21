import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgPermissions } from "@/lib/auth/permissions";
import { projectsAccessibleWhere } from "@/lib/organization/access";
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
import { Badge } from "@/components/ui/badge";
import { ProjectDeployButton } from "./project-deploy-button";
import { DeploymentTimeline } from "@/components/deployment-timeline";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { DashboardPage } from "@/components/dashboard-page";
import { FrameworkBadge } from "@/components/framework-badge";
import { ProjectInfraPanel } from "@/components/project-infra-panel";
import { ProjectLivePreview } from "@/components/project-live-preview";
import { toEnvVarClientRow } from "@/lib/project-env";
import { resolveProjectPublicUrl } from "@/lib/project-public-url";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: { id, ...projectsAccessibleWhere(session.user.id) },
    include: {
      server: true,
      environments: true,
      envVars: true,
      domains: { orderBy: { isPrimary: "desc" } },
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          status: true,
          kind: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          commitHash: true
        }
      }
    }
  });
  if (!project) {
    notFound();
  }

  const permissions = await getOrgPermissions(session.user.id, project.organizationId);

  const lastSuccessDeployment = await prisma.deployment.findFirst({
    where: {
      projectId: project.id,
      status: "success",
      kind: { in: ["full", "rollback"] },
      releasePath: { not: null }
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }]
  });

  const publicUrl = lastSuccessDeployment
    ? resolveProjectPublicUrl({
        domain: project.domain,
        domains: project.domains,
        serverHost: project.server.host,
        port: project.port,
        webServer: project.webServer
      })
    : null;

  const deployedAt = lastSuccessDeployment
    ? (lastSuccessDeployment.finishedAt ?? lastSuccessDeployment.createdAt)
    : null;

  const productionEnv =
    project.environments.find((e) => e.slug === "production") ?? project.environments[0];

  return (
    <DashboardPage>
      <Link href="/dashboard/projects" className={cn(buttonVariants({ variant: "ghost" }))}>
        ← Projects
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <FrameworkBadge framework={project.framework} />
          </div>
          <p className="text-muted-foreground font-mono text-sm">{project.repository}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectDeployButton projectId={project.id} />
          <DeleteProjectButton
            projectId={project.id}
            projectName={project.name}
            variant="detail"
            canDestructive={permissions.canDestructive}
          />
        </div>
      </div>
      {lastSuccessDeployment && deployedAt ? (
        <ProjectLivePreview publicUrl={publicUrl} deployedAt={deployedAt} />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Server</CardTitle>
            <CardDescription>SSH target</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{project.server.name}</p>
              {project.server.webStack !== "none" ? (
                <Badge variant="outline" className="capitalize">
                  {project.server.webStack}
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground font-mono">{project.server.host}</p>
            <p className="text-muted-foreground">User: {project.server.sshUser}</p>
            <Link
              href={`/dashboard/servers/${project.server.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Server detail
            </Link>
            <Link
              href={`/dashboard/servers/${project.server.id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Edit server
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deploy config</CardTitle>
            <CardDescription>Paths and commands</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Path: </span>
              <span className="font-mono">{project.deploymentPath}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Build: </span>
              <span className="font-mono">{project.buildCommand || "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Restart: </span>
              <span className="font-mono">{project.restartCommand || "—"}</span>
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Infrastructure</CardTitle>
          <CardDescription>Proxy configs, PM2, and deploy commands</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectInfraPanel
            project={{
              id: project.id,
              name: project.name,
              repository: project.repository,
              branch: project.branch,
              deploymentPath: project.deploymentPath,
              framework: project.framework,
              runtime: project.runtime,
              domain: project.domain,
              webServer: project.webServer,
              port: project.port,
              buildCommand: project.buildCommand,
              startCommand: project.startCommand,
              restartCommand: project.restartCommand,
              nginxConfig: project.nginxConfig,
              apacheConfig: project.apacheConfig,
              pm2Config: project.pm2Config,
              envVars: project.envVars.map(toEnvVarClientRow),
              githubInstallationId: project.githubInstallationId,
              productionEnvironmentId: productionEnv?.id ?? "",
              productionBranch: productionEnv?.branch ?? project.branch,
              serverId: project.serverId
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Environments</CardTitle>
          <CardDescription>Each maps a branch to deployments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {project.environments.map((e) => (
            <div key={e.id} className="flex justify-between border-b py-2 last:border-0">
              <span className="font-medium">{e.name}</span>
              <span className="text-muted-foreground font-mono">{e.slug}</span>
              <span className="font-mono">{e.branch}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Deployment timeline</CardTitle>
          <CardDescription>Queued → running → finished for recent runs</CardDescription>
        </CardHeader>
        <CardContent>
          <DeploymentTimeline deployments={project.deployments} />
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
