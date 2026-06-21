import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { normalizeOrgRole } from "@/lib/auth/roles";
import { canManageMembers } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { DashboardPage } from "@/components/dashboard-page";
import { AddWorkspaceMemberForm } from "@/components/add-workspace-member-form";
import { WorkspaceMemberRoleSelect } from "@/components/workspace-member-role-select";
import { RemoveWorkspaceMemberButton } from "@/components/remove-workspace-member-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

export default async function WorkspaceMembersPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;

  const { org: orgSlugParam } = await searchParams;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true, kind: true } }
    }
  });

  const manageable: typeof memberships = [];
  for (const m of memberships) {
    if (await canManageMembers(userId, m.organization.id)) {
      manageable.push(m);
    }
  }

  const selected =
    manageable.find((m) => m.organization.slug === orgSlugParam) ?? manageable[0] ?? null;

  const members =
    selected != null
      ? await prisma.organizationMember.findMany({
          where: { organizationId: selected.organization.id },
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            userId: true,
            user: { select: { name: true, email: true } }
          }
        })
      : [];

  return (
    <DashboardPage>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Manage roles for workspaces where you are an owner or admin.
        </p>
        <Button variant="outline" size="sm" render={<Link href="/dashboard/settings" />}>
          Back to settings
        </Button>
      </div>

      {manageable.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace members</CardTitle>
            <CardDescription>No workspaces to manage</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>
              Only workspace <strong>owners</strong> and <strong>admins</strong> can change member
              roles. GitHub org members are synced automatically when they sign in and use{" "}
              <strong>Sync GitHub installations</strong> in settings.
            </p>
            <Button size="sm" render={<Link href="/dashboard/settings" />}>
              Settings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>Select a workspace to manage its members</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="border-border flex flex-wrap gap-2">
                {manageable.map((m) => {
                  const active = m.organization.slug === selected?.organization.slug;
                  return (
                    <li key={m.organization.slug}>
                      <Button
                        variant={active ? "default" : "outline"}
                        size="sm"
                        render={
                          <Link
                            href={`/dashboard/settings/members?org=${encodeURIComponent(m.organization.slug)}`}
                          />
                        }
                      >
                        {m.organization.name}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle>{selected.organization.name}</CardTitle>
                <CardDescription>
                  {selected.organization.kind} workspace · {members.length} member
                  {members.length === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Add member</p>
                  <p className="text-muted-foreground text-xs">
                    The person must already have signed in to Central with GitHub. For GitHub org
                    teams, installing the app and syncing memberships is usually enough.
                  </p>
                  <AddWorkspaceMemberForm organizationSlug={selected.organization.slug} />
                </div>

                <ul className="border-border divide-y rounded-md border">
                  {members.map((m) => {
                    const role = normalizeOrgRole(m.role);
                    const isSelf = m.userId === userId;
                    return (
                      <li
                        key={m.userId}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                      >
                        <div>
                          <p className="font-medium">{m.user.name || m.user.email}</p>
                          <p className="text-muted-foreground text-xs">{m.user.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <WorkspaceMemberRoleSelect
                            organizationSlug={selected.organization.slug}
                            userId={m.userId}
                            currentRole={role}
                            disabled={isSelf}
                          />
                          {!isSelf ? (
                            <RemoveWorkspaceMemberButton
                              organizationSlug={selected.organization.slug}
                              userId={m.userId}
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs">You</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </DashboardPage>
  );
}
