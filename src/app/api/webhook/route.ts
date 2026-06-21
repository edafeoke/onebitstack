/**
 * Legacy unsigned GitHub webhook. Disabled by default.
 * Prefer `POST /api/github/webhook` with signature verification.
 */
import { handleGithubPushPayload } from "@/lib/github/push-deploy";

export const runtime = "nodejs";

function legacyWebhookEnabled(): boolean {
  const raw = process.env.ENABLE_LEGACY_GITHUB_WEBHOOK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export async function POST(request: Request): Promise<Response> {
  if (!legacyWebhookEnabled()) {
    return Response.json(
      {
        error: {
          code: "DISABLED",
          message:
            "Legacy unsigned webhook is disabled. Use POST /api/github/webhook with GITHUB_APP_WEBHOOK_SECRET, or set ENABLE_LEGACY_GITHUB_WEBHOOK=true for local testing only."
        }
      },
      { status: 410 }
    );
  }

  console.warn(
    "[github] Legacy unsigned webhook invoked — do not enable in production. Migrate to /api/github/webhook."
  );

  const event = request.headers.get("x-github-event");
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event !== "push") {
    return Response.json({ ok: true, skipped: "not_push" });
  }

  const result = await handleGithubPushPayload(body);
  return Response.json({
    ok: true,
    matched: result.matched,
    deploymentIds: result.deploymentIds,
    skipReason: result.skipReason
  });
}
