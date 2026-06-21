-- Webhook delivery audit fields for push deploy outcomes
ALTER TABLE "WebhookDelivery" ADD COLUMN "repository" TEXT;
ALTER TABLE "WebhookDelivery" ADD COLUMN "branch" TEXT;
ALTER TABLE "WebhookDelivery" ADD COLUMN "commitHash" TEXT;
ALTER TABLE "WebhookDelivery" ADD COLUMN "projectId" TEXT;
ALTER TABLE "WebhookDelivery" ADD COLUMN "deploymentId" TEXT;
ALTER TABLE "WebhookDelivery" ADD COLUMN "skipReason" TEXT;
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");
CREATE INDEX "WebhookDelivery_repository_idx" ON "WebhookDelivery"("repository");
