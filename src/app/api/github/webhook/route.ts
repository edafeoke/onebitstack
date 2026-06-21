import { prisma } from "@/lib/prisma";
import { verifyGitHubWebhookSignature } from "@/lib/github-verify";
import { handleGithubWebhookPayload } from "@/lib/github-webhook-signed";
import { recordWebhookDeliveryOutcome } from "@/lib/github/webhook-delivery";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret =
    process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() ||
    process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return Response.json(
      {
        error: {
          code: "MISCONFIGURED",
          message:
            "Set GITHUB_APP_WEBHOOK_SECRET (GitHub App) or GITHUB_WEBHOOK_SECRET (repo webhook)."
        }
      },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubWebhookSignature(rawBody, signature, secret)) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid signature" } },
      { status: 401 }
    );
  }

  const event = request.headers.get("x-github-event") ?? "";
  const deliveryId = request.headers.get("x-github-delivery") ?? "";
  if (!deliveryId) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Missing X-GitHub-Delivery" } },
      { status: 400 }
    );
  }

  const existing = await prisma.webhookDelivery.findUnique({
    where: { deliveryId }
  });
  if (existing) {
    return new Response(null, { status: 202 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const action =
    typeof parsed === "object" &&
    parsed !== null &&
    "action" in parsed &&
    typeof (parsed as { action?: unknown }).action === "string"
      ? (parsed as { action: string }).action
      : null;

  await prisma.webhookDelivery.create({
    data: {
      deliveryId,
      eventType: event,
      action,
      processed: false
    }
  });

  try {
    const result = await handleGithubWebhookPayload(parsed, { event, deliveryId });
    await recordWebhookDeliveryOutcome(deliveryId, result.push);
    await prisma.webhookDelivery.update({
      where: { deliveryId },
      data: { processed: true }
    });
  } catch (err) {
    console.error("[github webhook]", err);
    await prisma.webhookDelivery.deleteMany({ where: { deliveryId } });
    return Response.json(
      { error: { code: "INTERNAL", message: "Handler error" } },
      { status: 500 }
    );
  }

  return new Response(null, { status: 202 });
}
