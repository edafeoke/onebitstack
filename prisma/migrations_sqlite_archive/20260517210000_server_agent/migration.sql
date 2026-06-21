-- Server agent pairing + AgentJob queue
ALTER TABLE "Server" ADD COLUMN "agentStatus" TEXT NOT NULL DEFAULT 'disconnected';
ALTER TABLE "Server" ADD COLUMN "agentId" TEXT;
ALTER TABLE "Server" ADD COLUMN "agentTokenHash" TEXT;
ALTER TABLE "Server" ADD COLUMN "agentVersion" TEXT;
ALTER TABLE "Server" ADD COLUMN "lastAgentHeartbeatAt" DATETIME;
ALTER TABLE "Server" ADD COLUMN "agentPairingTokenHash" TEXT;
ALTER TABLE "Server" ADD COLUMN "agentPairingExpiresAt" DATETIME;
CREATE UNIQUE INDEX "Server_agentId_key" ON "Server"("agentId");
CREATE INDEX "Server_agentStatus_idx" ON "Server"("agentStatus");

CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scriptCipher" TEXT NOT NULL,
    "scriptIv" TEXT NOT NULL,
    "scriptTag" TEXT NOT NULL,
    "exitCode" INTEGER,
    "claimedAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentJob_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AgentJob_deploymentId_key" ON "AgentJob"("deploymentId");
CREATE INDEX "AgentJob_serverId_status_idx" ON "AgentJob"("serverId", "status");
CREATE INDEX "AgentJob_createdAt_idx" ON "AgentJob"("createdAt");
