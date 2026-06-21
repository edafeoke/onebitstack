import { prisma } from "@/lib/prisma";
import { ensurePersonalOrganization } from "@/lib/organization/access";
import {
  ensureOrganizationMembership,
  upsertOrganizationFromGithubAccount
} from "@/lib/organization/github-account";

type GithubOrgRow = {
  id: number;
  login: string;
  description?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function githubFetchJson(
  accessToken: string,
  path: string
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `GitHub API ${res.status} ${path}: ${body.slice(0, 200) || res.statusText}`
    };
  }
  return { ok: true, data: await res.json() };
}

/**
 * Sync GitHub org memberships for the signed-in user and link installations to org workspaces.
 * Call after sign-in and from Settings → Sync installations.
 */
export async function syncGithubMembershipsForUser(userId: string): Promise<{
  orgsSynced: number;
  error?: string;
}> {
  const githubAccount = await prisma.account.findFirst({
    where: { userId, providerId: "github" },
    select: { accountId: true, accessToken: true }
  });
  if (!githubAccount?.accessToken) {
    return { orgsSynced: 0, error: "Sign in with GitHub first." };
  }

  const token = githubAccount.accessToken;
  let orgsSynced = 0;

  await ensurePersonalOrganization(userId);

  const userRes = await githubFetchJson(token, "/user");
  if (userRes.ok && isRecord(userRes.data) && typeof userRes.data.login === "string") {
    const login = userRes.data.login;
    const githubId =
      typeof userRes.data.id === "number"
        ? String(userRes.data.id)
        : typeof userRes.data.id === "string"
          ? userRes.data.id
          : githubAccount.accountId;
    const personal = await upsertOrganizationFromGithubAccount({
      login,
      type: "User",
      githubId
    });
    await ensureOrganizationMembership(userId, personal.organizationId, "owner");
    orgsSynced++;
  }

  const orgsRes = await githubFetchJson(token, "/user/orgs?per_page=100");
  if (!orgsRes.ok) {
    return { orgsSynced, error: orgsRes.error };
  }

  if (Array.isArray(orgsRes.data)) {
    for (const row of orgsRes.data) {
      if (!isRecord(row)) continue;
      const org = row as GithubOrgRow;
      if (typeof org.login !== "string") continue;
      const githubId = typeof org.id === "number" ? String(org.id) : null;
      const workspace = await upsertOrganizationFromGithubAccount({
        login: org.login,
        type: "Organization",
        githubId
      });
      await ensureOrganizationMembership(userId, workspace.organizationId, "developer");
      orgsSynced++;
    }
  }

  return { orgsSynced };
}
