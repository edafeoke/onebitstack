import { handleGithubPushPayload } from "@/lib/github/push-deploy";

/**
 * @deprecated Use handleGithubPushPayload via /api/github/webhook.
 */
export async function handleGithubPushWebhook(
  event: string | null,
  body: unknown
): Promise<{ attempted: boolean; skippedReason?: string }> {
  if (event !== "push") {
    return { attempted: false, skippedReason: "not_push" };
  }
  const result = await handleGithubPushPayload(body);
  return {
    attempted: result.matched,
    skippedReason: result.skipReason
  };
}
