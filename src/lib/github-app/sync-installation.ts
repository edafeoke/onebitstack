import { prisma } from "@/lib/prisma";
import {
  ensureOrganizationMembership,
  upsertOrganizationFromGithubAccount
} from "@/lib/organization/github-account";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function resolveUserIdFromSender(sender: Record<string, unknown>): Promise<string | null> {
  const githubUserId =
    typeof sender.id === "number"
      ? String(sender.id)
      : typeof sender.id === "string"
        ? sender.id
        : null;
  if (!githubUserId) return null;
  const account = await prisma.account.findFirst({
    where: { providerId: "github", accountId: githubUserId },
    select: { userId: true }
  });
  return account?.userId ?? null;
}

/**
 * Handle GitHub App `installation` webhook actions.
 */
export async function syncGithubInstallationFromWebhook(payload: unknown): Promise<void> {
  if (!isRecord(payload)) return;
  const action = typeof payload.action === "string" ? payload.action : "";
  const installation = isRecord(payload.installation) ? payload.installation : null;
  const instIdRaw = installation?.id;
  const installationId =
    typeof instIdRaw === "number"
      ? String(instIdRaw)
      : typeof instIdRaw === "string"
        ? instIdRaw
        : null;
  if (!installationId) return;

  const account = installation && isRecord(installation.account) ? installation.account : null;
  const accountLogin = typeof account?.login === "string" ? account.login : "unknown";
  const accountType = typeof account?.type === "string" ? account.type : "User";
  const accountGithubId =
    account && typeof account.id === "number"
      ? String(account.id)
      : account && typeof account.id === "string"
        ? account.id
        : null;

  const sender = isRecord(payload.sender) ? payload.sender : null;
  const installerGithubId =
    sender && typeof sender.id === "number"
      ? String(sender.id)
      : sender && typeof sender.id === "string"
        ? sender.id
        : null;

  if (action === "deleted") {
    await prisma.gitHubAppInstallation.deleteMany({
      where: { installationId }
    });
    return;
  }

  if (action === "suspend") {
    await prisma.gitHubAppInstallation.updateMany({
      where: { installationId },
      data: { suspended: true }
    });
    return;
  }

  if (action === "unsuspend") {
    await prisma.gitHubAppInstallation.updateMany({
      where: { installationId },
      data: { suspended: false }
    });
    return;
  }

  if (action === "created" || action === "new_permissions_accepted") {
    const workspace = await upsertOrganizationFromGithubAccount({
      login: accountLogin,
      type: accountType,
      githubId: accountGithubId
    });

    const userId = sender ? await resolveUserIdFromSender(sender) : null;
    if (userId) {
      await ensureOrganizationMembership(userId, workspace.organizationId, "admin");
    } else {
      console.warn(
        "[github-app] installation webhook: sender not linked to a Central Server user (sign in with GitHub first).",
        { installationId, action }
      );
    }

    const suspendedAt = installation?.suspended_at;
    const suspended = suspendedAt != null && suspendedAt !== false;

    await prisma.gitHubAppInstallation.upsert({
      where: { installationId },
      create: {
        installationId,
        organizationId: workspace.organizationId,
        accountLogin,
        accountType,
        installerGithubId,
        suspended
      },
      update: {
        organizationId: workspace.organizationId,
        accountLogin,
        accountType,
        installerGithubId,
        suspended
      }
    });
  }
}
