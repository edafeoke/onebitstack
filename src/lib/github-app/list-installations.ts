import { prisma } from "@/lib/prisma";
import { getGithubAppConfig } from "@/lib/github-app/config";
import { createGithubAppJwt } from "@/lib/github-app/jwt";
import {
  ensureOrganizationMembership,
  upsertOrganizationFromGithubAccount
} from "@/lib/organization/github-account";
import { syncGithubMembershipsForUser } from "@/lib/organization/sync-memberships";

type GithubInstallationRow = {
  id: number;
  account?: { login?: string; type?: string; id?: number };
  suspended_at?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * List all installations for this GitHub App (app JWT), link each to an org workspace,
 * and ensure the signed-in user is a member of that workspace.
 */
export async function syncGithubInstallationsForUser(userId: string): Promise<{
  synced: number;
  error?: string;
}> {
  const membership = await syncGithubMembershipsForUser(userId);
  if (membership.error && membership.orgsSynced === 0) {
    return { synced: 0, error: membership.error };
  }

  const cfg = getGithubAppConfig();
  if (!cfg) {
    return { synced: 0, error: "GitHub App is not configured on this server." };
  }

  const githubAccount = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
    select: { accountId: true }
  });
  if (!githubAccount) {
    return {
      synced: 0,
      error: "Sign in with GitHub first."
    };
  }

  const jwt = createGithubAppJwt(cfg.appId, cfg.privateKey);
  const res = await fetch("https://api.github.com/app/installations", {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      synced: 0,
      error: `GitHub API ${res.status}: ${body.slice(0, 200) || res.statusText}`
    };
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    return { synced: 0, error: "Unexpected response from GitHub installations API." };
  }

  let synced = 0;
  for (const row of data) {
    if (!isRecord(row)) continue;
    const inst = row as GithubInstallationRow;
    const installationId = String(inst.id);
    const account = inst.account;
    const accountLogin =
      typeof account?.login === "string" ? account.login : "unknown";
    const accountType = typeof account?.type === "string" ? account.type : "User";
    const accountGithubId =
      typeof account?.id === "number" ? String(account.id) : null;
    const suspended = inst.suspended_at != null && inst.suspended_at !== "";

    const workspace = await upsertOrganizationFromGithubAccount({
      login: accountLogin,
      type: accountType,
      githubId: accountGithubId
    });
    await ensureOrganizationMembership(userId, workspace.organizationId, "admin");

    await prisma.gitHubAppInstallation.upsert({
      where: { installationId },
      create: {
        installationId,
        organizationId: workspace.organizationId,
        accountLogin,
        accountType,
        installerGithubId: githubAccount.accountId,
        suspended
      },
      update: {
        organizationId: workspace.organizationId,
        accountLogin,
        accountType,
        installerGithubId: githubAccount.accountId,
        suspended
      }
    });
    synced++;
  }

  return { synced };
}
