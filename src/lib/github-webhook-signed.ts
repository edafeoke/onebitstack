import { syncGithubInstallationFromWebhook } from "@/lib/github-app/sync-installation";
import { handleGithubPushPayload } from "@/lib/github/push-deploy";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type GithubWebhookHandlerResult = {
  push?: Awaited<ReturnType<typeof handleGithubPushPayload>>;
};

export async function handleGithubWebhookPayload(
  payload: unknown,
  meta: { event: string; deliveryId: string }
): Promise<GithubWebhookHandlerResult> {
  if (!isRecord(payload)) return {};

  if (meta.event === "ping") {
    return {};
  }

  if (meta.event === "installation") {
    await syncGithubInstallationFromWebhook(payload);
    return {};
  }

  if (meta.event === "push") {
    const push = await handleGithubPushPayload(payload);
    return { push };
  }

  return {};
}

export { handleGithubPushPayload, queueDeploymentsFromGithubPush } from "@/lib/github/push-deploy";
