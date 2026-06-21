import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubAppSetupPanel } from "@/components/github-app-setup-panel";
import { DashboardPage } from "@/components/dashboard-page";
import { isSaasMode } from "@/lib/auth-config";
import { getGithubAppConfig } from "@/lib/github-app/config";
import { getGithubAppSetupStatus } from "@/lib/github-app/setup";
import { cn } from "@/lib/utils";

export default async function AdminGithubPage() {
  const saasMode = isSaasMode();
  const status = getGithubAppSetupStatus();
  const cfg = getGithubAppConfig();

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GitHub App setup</h1>
          <p className="text-muted-foreground text-sm">
            Instance-level GitHub App for repos, webhooks, and OAuth on this VPS.
          </p>
        </div>
        <Link href="/dashboard/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Admin
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configure credentials</CardTitle>
          <CardDescription>
            Manifest flow or manual paste — credentials stay in <code>.env</code> (not the database).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GithubAppSetupPanel
            status={status}
            setupAllowed={!saasMode}
            saasMode={saasMode}
            appSlug={cfg?.appSlug}
            backHref="/dashboard/admin/github"
          />
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
