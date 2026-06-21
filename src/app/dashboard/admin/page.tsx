import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPage } from "@/components/dashboard-page";

export default async function AdminOverviewPage() {
  const [userCount, orgCount, serverCount, projectCount, deploymentCount] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.server.count(),
    prisma.project.count(),
    prisma.deployment.count()
  ]);

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
          <p className="text-muted-foreground text-sm">Cross-tenant overview and user management.</p>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Dashboard
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Registered accounts</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{userCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>Workspaces</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{orgCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Servers</CardTitle>
            <CardDescription>VPS targets</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{serverCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Deployed apps</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{projectCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deployments</CardTitle>
            <CardDescription>All-time runs</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{deploymentCount}</CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/admin/users" className={cn(buttonVariants())}>
          Manage users
        </Link>
        <Link href="/dashboard/admin/organizations" className={cn(buttonVariants({ variant: "outline" }))}>
          View organizations
        </Link>
        <Link href="/dashboard/admin/github" className={cn(buttonVariants({ variant: "outline" }))}>
          GitHub App setup
        </Link>
      </div>
    </DashboardPage>
  );
}
