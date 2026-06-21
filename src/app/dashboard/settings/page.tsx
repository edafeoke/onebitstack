import Link from "next/link";
import { canManageMembers } from "@/lib/auth/permissions";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { normalizeOrgRole } from "@/lib/auth/roles";
import { getSessionUserRole } from "@/lib/require-session";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { isSaasMode } from "@/lib/auth-config";
import { isCredentialAuthEnabled, isGithubLoginConfigured } from "@/lib/auth-config";
import { getPublicAppName } from "@/lib/app-config";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { SyncGithubInstallationsButton } from "@/components/sync-github-installations-button";
import { DashboardPage } from "@/components/dashboard-page";
import { getGithubAppConfig } from "@/lib/github-app/config";
import { installationsAccessibleWhere } from "@/lib/organization/access";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const platformRole = session ? getSessionUserRole(session) : "user";
  const userId = session?.user?.id;

  const installations =
    userId != null
      ? await prisma.gitHubAppInstallation.findMany({
          where: installationsAccessibleWhere(userId),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            installationId: true,
            accountLogin: true,
            accountType: true,
            suspended: true,
            organization: { select: { name: true, slug: true } }
          }
        })
      : [];

  const workspaces =
    userId != null
      ? await prisma.organizationMember.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            organization: { select: { id: true, name: true, slug: true, kind: true } }
          }
        })
      : [];

  let canManageAnyMembers = false;
  if (userId != null) {
    for (const w of workspaces) {
      if (await canManageMembers(userId, w.organization.id)) {
        canManageAnyMembers = true;
        break;
      }
    }
  }

  const hasGithubAccount =
    userId != null
      ? (await prisma.account.findFirst({
          where: { userId, providerId: "github" },
          select: { id: true }
        })) != null
      : false;

  const appName = getPublicAppName();
  const githubLoginConfigured = isGithubLoginConfigured();
  const credentialAuthEnabled = isCredentialAuthEnabled();
  const appCfg = getGithubAppConfig();
  const showGithubSetupCta =
    userId != null &&
    !isSaasMode() &&
    !appCfg &&
    (await isPlatformAdmin(userId));
  const installHref =
    appCfg?.appSlug != null && appCfg.appSlug.length > 0
      ? `https://github.com/apps/${encodeURIComponent(appCfg.appSlug)}/installations/new`
      : null;

  return (
    <DashboardPage>
      <p className="text-muted-foreground text-sm">Account and environment hints.</p>
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Email account and GitHub for {appName}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p className="text-foreground">
            Signed in as {session?.user?.email}
            {hasGithubAccount ? " · GitHub linked" : " · GitHub not linked yet"}
          </p>
          {credentialAuthEnabled ? (
            <p>Email and password sign-in is enabled for this instance.</p>
          ) : null}
          {githubLoginConfigured ? (
            <p className="text-foreground">
              GitHub OAuth is configured. Callback:{" "}
              <code className="text-foreground">/api/auth/callback/github</code>
              {!hasGithubAccount ? (
                <>
                  {" "}
                  Use <strong>Continue with GitHub</strong> on the login page or link from your
                  profile to import org repos.
                </>
              ) : null}
            </p>
          ) : (
            <div className="border-destructive/50 bg-destructive/10 text-destructive space-y-2 rounded-lg border p-3">
              <p className="font-medium">GitHub OAuth is not configured</p>
              <p>
                Set <code className="font-mono text-xs">GITHUB_CLIENT_ID</code> and{" "}
                <code className="font-mono text-xs">GITHUB_CLIENT_SECRET</code>, or reuse{" "}
                <code className="font-mono text-xs">GITHUB_APP_CLIENT_ID</code> /{" "}
                <code className="font-mono text-xs">GITHUB_APP_CLIENT_SECRET</code>, then restart.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Signed-in user</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name: </span>
            {session?.user?.name}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {session?.user?.email}
          </p>
          <p>
            <span className="text-muted-foreground">Role: </span>
            {platformRole}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <CardDescription>
            Shared access is scoped to these GitHub accounts and organizations.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          {workspaces.length === 0 ? (
            <p>
              No workspaces yet. Sign in with GitHub and use sync below to import your org
              memberships.
            </p>
          ) : (
            <ul className="border-border divide-y rounded-md border">
              {workspaces.map((w) => (
                <li
                  key={w.organization.slug}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="text-foreground font-medium">{w.organization.name}</span>
                  <span className="text-xs">
                    {w.organization.kind} · {normalizeOrgRole(w.role)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManageAnyMembers ? (
            <p className="pt-2">
              <Link href="/dashboard/settings/members" className="text-primary text-sm font-medium underline">
                Manage workspace members
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>GitHub App</CardTitle>
          <CardDescription>
            Install the app on your GitHub organization. Teammates in that org see the same VPS,
            projects, and repos after they sign in and sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          {showGithubSetupCta ? (
            <div className="border-primary/30 bg-primary/5 rounded-lg border p-3">
              <p className="text-foreground font-medium">Configure GitHub App for this server</p>
              <p className="mt-1 text-xs">
                Use the guided manifest flow to register webhooks and OAuth for this VPS.
              </p>
              <Link
                href="/dashboard/admin/github"
                className="text-primary mt-2 inline-block text-sm font-medium underline"
              >
                Open GitHub App setup →
              </Link>
            </div>
          ) : null}
          {!appCfg ? (
            <p>
              Configure{" "}
              <code className="text-foreground">GITHUB_APP_ID</code>,{" "}
              <code className="text-foreground">GITHUB_PRIVATE_KEY</code> (or{" "}
              <code className="text-foreground">GITHUB_APP_PRIVATE_KEY</code>),{" "}
              <code className="text-foreground">GITHUB_APP_CLIENT_ID</code>, and{" "}
              <code className="text-foreground">GITHUB_APP_CLIENT_SECRET</code>. Set{" "}
              <code className="text-foreground">GITHUB_APP_SLUG</code> or{" "}
              <code className="text-foreground">NEXT_PUBLIC_GITHUB_APP_SLUG</code> for the install link.
            </p>
          ) : installHref ? (
            <p>
              <Link href={installHref} className="text-primary font-medium underline" target="_blank">
                Install GitHub App
              </Link>{" "}
              (opens GitHub). Use the same webhook URL and secret as below.
            </p>
          ) : (
            <p>
              Set <code className="text-foreground">GITHUB_APP_SLUG</code> to enable the install link.
            </p>
          )}
          <div>
            <p className="text-foreground mb-1 font-medium">Linked installations</p>
            {installations.length === 0 ? (
              <div className="space-y-2">
                <p>
                  None yet. Installations are linked when GitHub sends an{" "}
                  <code className="text-foreground">installation</code> webhook, or when you sync
                  below.
                </p>
                <ol className="list-inside list-decimal space-y-1 text-xs">
                  <li>Sign in with GitHub.</li>
                  <li>
                    Install the app on GitHub (link above). Webhook URL:{" "}
                    <code className="text-foreground">POST /api/github/webhook</code>
                  </li>
                  <li>Webhook secret must match <code className="text-foreground">GITHUB_APP_WEBHOOK_SECRET</code>.</li>
                  <li>Click sync if you installed before signing in.</li>
                </ol>
                {appCfg && hasGithubAccount ? <SyncGithubInstallationsButton /> : null}
                {appCfg && !hasGithubAccount ? (
                  <p className="text-xs">
                    <Link href="/login" className="text-primary underline">
                      Sign in with GitHub
                    </Link>{" "}
                    to enable sync.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <ul className="border-border divide-y rounded-md border">
                  {installations.map((i) => (
                    <li
                      key={i.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span className="text-foreground font-medium">{i.accountLogin}</span>
                      <span className="text-xs">
                        {i.accountType}
                        {i.suspended ? " · suspended" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {appCfg && hasGithubAccount ? <SyncGithubInstallationsButton /> : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>GitHub pushes and app installation events</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Signed endpoint: <code className="text-foreground">POST /api/github/webhook</code>
          </p>
          <p>
            Push deploys only when the branch matches each project environment (e.g.{" "}
            <code className="text-foreground">main</code> or your configured branch).
          </p>
          <p>
            Legacy unsigned route <code className="text-foreground">POST /api/webhook</code> is{" "}
            <strong>disabled</strong> unless{" "}
            <code className="text-foreground">ENABLE_LEGACY_GITHUB_WEBHOOK=true</code> (local testing
            only).
          </p>
          <p>
            Secret: <code className="text-foreground">GITHUB_APP_WEBHOOK_SECRET</code> (app) or{" "}
            <code className="text-foreground">GITHUB_WEBHOOK_SECRET</code> (repo webhook). OAuth callback:{" "}
            <code className="text-foreground">/api/auth/callback/github</code>
          </p>
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
